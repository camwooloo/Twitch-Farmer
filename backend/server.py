# -*- coding: utf-8 -*-
"""
Twitch Farmer backend.

A small aiohttp server (REST + WebSocket) that the Tauri/React front-end talks
to over localhost. The Rust shell launches this process with a free --port and
a shared --token; the front-end fetches both from Rust and authenticates every
request with the token.

Run standalone (dev):
    python server.py --port 8917 --token dev
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import asdict

import aiohttp
from aiohttp import web, WSMsgType

from hub import Hub
from engines import PointsEngine, DropsEngine
import config as cfgmod


hub = Hub()
points = PointsEngine(hub)
drops = DropsEngine(hub)
TOKEN = "dev"

# Public web client-id — allows anonymous GQL search (games / channels).
TWITCH_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko"
_http: aiohttp.ClientSession | None = None

# Smart-TV client (shared by both miners) — authenticated GQL for follows /
# points / rewards. Persisted-query hashes are Twitch's current ones.
SMARTBOX_CLIENT_ID = "ue6666qo983tsx6so1t0vnawi233wa"
SMARTBOX_URL = "https://android.tv.twitch.tv"
SMARTBOX_UA = (
    "Mozilla/5.0 (Linux; Android 7.1; Smart Box C1) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
)
DEVICE_ID = "f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6"
SESSION_ID = "a1b2c3d4e5f60718"
HASH_CHANNEL_FOLLOWS = "eecf815273d3d949e5cf0085cc5084cd8a1b5b7b6f7990cf43cb0beadf546907"
HASH_POINTS_CONTEXT = "1530a003a7d374b0380b79db0be0534f30ff46e61cffa2bc0e2468a909fbc024"


# --------------------------------------------------------------------------- #
# middleware: CORS + token auth
# --------------------------------------------------------------------------- #
@web.middleware
async def cors_auth_middleware(request: web.Request, handler):
    if request.method == "OPTIONS":
        return _cors(web.Response(status=204))

    # token check (skip for health so the shell can poll readiness)
    if request.path != "/api/health":
        token = request.headers.get("X-Token") or request.query.get("token")
        if token != TOKEN:
            return _cors(web.json_response({"error": "unauthorized"}, status=401))

    try:
        resp = await handler(request)
    except web.HTTPException as exc:
        return _cors(exc)
    return _cors(resp)


def _cors(resp: web.StreamResponse) -> web.StreamResponse:
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Token"
    return resp


# --------------------------------------------------------------------------- #
# REST handlers
# --------------------------------------------------------------------------- #
async def health(_request: web.Request) -> web.Response:
    return web.json_response({"ok": True, "version": "0.1.0"})


async def get_config(_request: web.Request) -> web.Response:
    cfg = cfgmod.load_config()
    return web.json_response(cfgmod.config_to_dict(cfg))


async def put_config(request: web.Request) -> web.Response:
    data = await request.json()
    cfg = cfgmod._from_dict(cfgmod.Config, data)
    cfgmod.save_config(cfg)
    hub.emit("config", cfgmod.config_to_dict(cfg))
    return web.json_response({"ok": True})


async def get_status(_request: web.Request) -> web.Response:
    return web.json_response({
        "state": hub.state,
        "logs": hub.log_history,
    })


async def control(request: web.Request) -> web.Response:
    body = await request.json()
    engine = body.get("engine", "all")
    action = body.get("action")
    if action not in ("start", "stop"):
        return web.json_response({"error": "bad action"}, status=400)
    cfg = cfgmod.load_config()
    start = action == "start"

    async def do_points():
        await (points.start_watch(cfg) if start else points.stop_watch())

    async def do_predictions():
        await (points.start_predict(cfg) if start else points.stop_predict(cfg))

    async def do_drops():
        await (drops.start(cfg) if start else drops.stop())

    if engine == "points":
        await do_points()
    elif engine == "predictions":
        await do_predictions()
    elif engine == "drops":
        await do_drops()
    elif engine == "all":
        if start:
            # start whichever engines are enabled
            if cfg.predictions_enabled:
                await do_predictions()   # implies watching
            elif cfg.points_enabled:
                await do_points()
            if cfg.drops.enabled:
                await do_drops()
        else:
            await points.stop_watch()
            await drops.stop()
    else:
        return web.json_response({"error": "unknown engine"}, status=400)

    return web.json_response({"ok": True, "state": hub.state})


# --------------------------------------------------------------------------- #
# Twitch GQL search (anonymous) — powers the autocomplete dropdowns
# --------------------------------------------------------------------------- #
async def _gql(query: str, variables: dict) -> dict:
    global _http
    if _http is None:
        _http = aiohttp.ClientSession()
    async with _http.post(
        "https://gql.twitch.tv/gql",
        headers={"Client-ID": TWITCH_CLIENT_ID},
        json={"query": query, "variables": variables},
        timeout=aiohttp.ClientTimeout(total=8),
    ) as resp:
        return await resp.json()


def _auth_token() -> str | None:
    cfg = cfgmod.load_config()
    import token_bridge
    token = token_bridge.read_points_token(cfg.username)
    if token:
        return token
    try:
        return token_bridge.read_drops_token()
    except Exception:
        return None


async def _gql_auth(body) -> dict | list | None:
    """Authenticated GQL call with the Smart-TV headers Twitch expects."""
    global _http
    if _http is None:
        _http = aiohttp.ClientSession()
    token = _auth_token()
    if not token:
        return None
    headers = {
        "Client-ID": SMARTBOX_CLIENT_ID,
        "Authorization": f"OAuth {token}",
        "X-Device-Id": DEVICE_ID,
        "Client-Session-Id": SESSION_ID,
        "Origin": SMARTBOX_URL,
        "Referer": SMARTBOX_URL,
        "User-Agent": SMARTBOX_UA,
    }
    async with _http.post(
        "https://gql.twitch.tv/gql", headers=headers, json=body,
        timeout=aiohttp.ClientTimeout(total=10),
    ) as resp:
        return await resp.json()


async def get_follows(_request: web.Request) -> web.Response:
    """The authenticated user's followed channels."""
    results: list[dict] = []
    cursor = ""
    for _ in range(4):  # up to ~400 follows
        data = await _gql_auth([{
            "operationName": "ChannelFollows",
            "variables": {"limit": 100, "order": "DESC", "cursor": cursor},
            "extensions": {"persistedQuery": {"version": 1, "sha256Hash": HASH_CHANNEL_FOLLOWS}},
        }])
        if not data:
            break
        try:
            follows = data[0]["data"]["user"]["follows"]
            for e in follows["edges"]:
                n = e["node"]
                results.append({
                    "login": n["login"],
                    "name": n.get("displayName") or n["login"],
                    "image": n.get("profileImageURL"),
                })
                cursor = e.get("cursor", "")
            if not follows["pageInfo"]["hasNextPage"]:
                break
        except (KeyError, TypeError, IndexError):
            break
    return web.json_response({"results": results})


async def get_channel(request: web.Request) -> web.Response:
    """Point balance, custom rewards and live status for a channel."""
    login = (request.query.get("login") or "").strip().lower()
    if not login:
        return web.json_response({"error": "login required"}, status=400)
    out: dict = {"login": login, "balance": None, "live": False, "game": None, "viewers": 0, "rewards": []}
    data = await _gql_auth([
        {
            "operationName": "ChannelPointsContext",
            "variables": {"channelLogin": login},
            "extensions": {"persistedQuery": {"version": 1, "sha256Hash": HASH_POINTS_CONTEXT}},
        },
        {"query": "{user(login:\"%s\"){stream{viewersCount game{name}}}}" % login},
    ])
    if not data:
        return web.json_response(out)
    try:
        community = data[0]["data"]["community"]
        ch = community["channel"]
        out["balance"] = ch["self"]["communityPoints"]["balance"]
        rewards = (community.get("channel", {})
                   .get("communityPointsSettings", {}) or {}).get("customRewards") or []
        # customRewards lives under communityPointsSettings; fall back to scan
        cps = ch.get("communityPointsSettings") or community.get("communityPointsSettings") or {}
        rewards = cps.get("customRewards") or rewards
        out["rewards"] = [
            {"title": r.get("title"), "cost": r.get("cost"),
             "image": (r.get("defaultImage") or {}).get("url")}
            for r in rewards if r.get("cost")
        ]
    except (KeyError, TypeError, IndexError):
        pass
    try:
        stream = data[1]["data"]["user"]["stream"]
        if stream:
            out["live"] = True
            out["viewers"] = stream.get("viewersCount", 0)
            out["game"] = (stream.get("game") or {}).get("name")
    except (KeyError, TypeError, IndexError):
        pass
    return web.json_response(out)


async def search_games(request: web.Request) -> web.Response:
    q = (request.query.get("q") or "").strip()
    if len(q) < 2:
        return web.json_response({"results": []})
    try:
        data = await _gql(
            "query($q:String!){searchCategories(query:$q,first:8)"
            "{edges{node{id name boxArtURL(width:72,height:96)}}}}",
            {"q": q},
        )
        edges = (((data.get("data") or {}).get("searchCategories") or {}).get("edges")) or []
        results = [
            {"id": e["node"]["id"], "name": e["node"]["name"], "image": e["node"].get("boxArtURL")}
            for e in edges if e.get("node")
        ]
    except Exception:
        results = []
    return web.json_response({"results": results})


async def search_channels(request: web.Request) -> web.Response:
    q = (request.query.get("q") or "").strip()
    if len(q) < 2:
        return web.json_response({"results": []})
    try:
        data = await _gql(
            "query($q:String!){searchUsers(userQuery:$q,first:8)"
            "{edges{node{id login displayName profileImageURL(width:50)}}}}",
            {"q": q},
        )
        edges = (((data.get("data") or {}).get("searchUsers") or {}).get("edges")) or []
        results = [
            {
                "id": e["node"]["id"],
                "login": e["node"]["login"],
                "name": e["node"]["displayName"],
                "image": e["node"].get("profileImageURL"),
            }
            for e in edges if e.get("node")
        ]
    except Exception:
        results = []
    return web.json_response({"results": results})


# --------------------------------------------------------------------------- #
# Analytics — read the points-over-time series the miner records
# --------------------------------------------------------------------------- #
import re as _re

_STATUS_SETS = {
    "staff", "admin", "global_mod", "moderator", "broadcaster", "vip", "partner",
    "turbo", "ambassador", "verified", "no_audio", "no_video", "game-developer",
    "twitch-recap", "clip-champ", "artist-badge", "extension", "moments",
    "prime-gaming", "premium",
}


def _badge_category(sid: str, desc: str) -> str:
    """Use the badge's own description ("how it's earned") to categorise."""
    d = (desc or "").lower()
    if "cheer" in d or "bits" in d or sid.startswith("bits"):
        return "bits"
    if "subscrib" in d or "gift" in d or "subscription" in d:
        return "subscription"
    if "watch" in d or "tuning in" in d or "tune in" in d or "tuned in" in d or "viewing" in d:
        return "watch"
    if sid in _STATUS_SETS or _re.search(r"staff|moderator|broadcaster|partner|turbo|admin|ambassador", sid):
        return "status"
    return "other"


async def get_badges(_request: web.Request) -> web.Response:
    """All Twitch badges, categorised by how they're earned, with ownership."""
    global _http
    if _http is None:
        _http = aiohttp.ClientSession()
    cats: dict[str, list] = {"watch": [], "subscription": [], "bits": [], "status": [], "other": []}

    owned: set[str] = set()
    try:
        data = await _gql_auth({"query": "{currentUser{availableBadges{setID}}}"})
        for b in (((data or {}).get("data") or {}).get("currentUser") or {}).get("availableBadges") or []:
            if b.get("setID"):
                owned.add(b["setID"])
    except Exception:
        pass

    try:
        async with _http.post(
            "https://gql.twitch.tv/gql",
            headers={"Client-ID": TWITCH_CLIENT_ID},
            json={"query": "{badges{setID version title imageURL description}}"},
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            data = await resp.json()
        seen = set()
        for b in (data.get("data") or {}).get("badges") or []:
            sid = b.get("setID", "")
            if not sid or sid in seen:
                continue
            seen.add(sid)
            desc = b.get("description") or ""
            entry = {
                "id": sid, "title": b.get("title") or sid, "image": b.get("imageURL"),
                "description": desc, "owned": sid in owned,
            }
            cats[_badge_category(sid, desc)].append(entry)
        for k in cats:
            cats[k].sort(key=lambda e: (not e["owned"], e["title"].lower()))
    except Exception:
        pass
    return web.json_response({"categories": cats, "owned_count": len(owned)})


GITHUB_REPO = "camwooloo/Twitch-Farmer"


async def get_updates(_request: web.Request) -> web.Response:
    """List GitHub releases (newest first) with notes + installer asset URL."""
    global _http
    if _http is None:
        _http = aiohttp.ClientSession()
    out: list[dict] = []
    try:
        async with _http.get(
            f"https://api.github.com/repos/{GITHUB_REPO}/releases",
            headers={"Accept": "application/vnd.github+json", "User-Agent": "TwitchFarmer"},
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            data = await resp.json()
        for r in data if isinstance(data, list) else []:
            if r.get("draft"):
                continue
            exe = next(
                (a["browser_download_url"] for a in r.get("assets", [])
                 if a.get("name", "").lower().endswith(".exe")),
                None,
            )
            out.append({
                "tag": r.get("tag_name", ""),
                "name": r.get("name") or r.get("tag_name", ""),
                "notes": r.get("body", ""),
                "date": r.get("published_at", ""),
                "exe_url": exe,
                "html_url": r.get("html_url", ""),
            })
    except Exception:
        pass
    return web.json_response({"releases": out})


async def download_update(request: web.Request) -> web.Response:
    """Download a release installer to temp and return its path (so the UI can run it)."""
    body = await request.json()
    url = body.get("url", "")
    # only allow our own release assets
    if not url.startswith(f"https://github.com/{GITHUB_REPO}/releases/download/"):
        return web.json_response({"error": "invalid url"}, status=400)
    global _http
    if _http is None:
        _http = aiohttp.ClientSession()
    import tempfile
    try:
        dest = os.path.join(tempfile.gettempdir(), os.path.basename(url))
        async with _http.get(url, timeout=aiohttp.ClientTimeout(total=120)) as resp:
            if resp.status != 200:
                return web.json_response({"error": f"http {resp.status}"}, status=502)
            with open(dest, "wb") as fh:
                async for chunk in resp.content.iter_chunked(1 << 16):
                    fh.write(chunk)
        return web.json_response({"path": dest})
    except Exception as exc:  # noqa: BLE001
        return web.json_response({"error": str(exc)}, status=500)


async def get_analytics(_request: web.Request) -> web.Response:
    cfg = cfgmod.load_config()
    base = cfgmod.data_dir() / "analytics" / (cfg.username or "")
    series: dict[str, list] = {}
    if base.is_dir():
        for f in base.glob("*.json"):
            try:
                raw = json.loads(f.read_text(encoding="utf-8"))
                pts = raw.get("series", [])
                # keep only x (ms) and y (points)
                series[f.stem] = [
                    {"x": p["x"], "y": p["y"]}
                    for p in pts
                    if "x" in p and "y" in p
                ]
            except Exception:
                continue
    return web.json_response({"streamers": series})


async def ws_handler(request: web.Request) -> web.WebSocketResponse:
    token = request.query.get("token")
    ws = web.WebSocketResponse(heartbeat=30)
    await ws.prepare(request)
    if token != TOKEN:
        await ws.send_json({"kind": "error", "payload": "unauthorized"})
        await ws.close()
        return ws

    # snapshot on connect
    await ws.send_json({"kind": "snapshot", "payload": {
        "state": hub.state, "logs": hub.log_history,
    }})

    queue = hub.subscribe()
    try:
        async def pump():
            while True:
                event = await queue.get()
                await ws.send_json(event)

        pump_task = asyncio.create_task(pump())
        async for msg in ws:
            if msg.type == WSMsgType.ERROR:
                break
        pump_task.cancel()
    finally:
        hub.unsubscribe(queue)
    return ws


# --------------------------------------------------------------------------- #
# app factory + lifecycle
# --------------------------------------------------------------------------- #
def make_app() -> web.Application:
    app = web.Application(middlewares=[cors_auth_middleware])
    app.add_routes([
        web.get("/api/health", health),
        web.get("/api/config", get_config),
        web.put("/api/config", put_config),
        web.get("/api/status", get_status),
        web.post("/api/control", control),
        web.get("/api/twitch/games", search_games),
        web.get("/api/twitch/channels", search_channels),
        web.get("/api/twitch/follows", get_follows),
        web.get("/api/twitch/channel", get_channel),
        web.get("/api/twitch/badges", get_badges),
        web.get("/api/updates", get_updates),
        web.post("/api/update/download", download_update),
        web.get("/api/analytics", get_analytics),
        web.get("/ws", ws_handler),
    ])
    return app


async def _on_cleanup(_app: web.Application) -> None:
    global _http
    if _http is not None:
        await _http.close()
        _http = None


async def _on_startup(_app: web.Application) -> None:
    hub.bind_loop(asyncio.get_running_loop())
    hub.log("info", "Backend started", "app")
    # optionally autostart mining
    cfg = cfgmod.load_config()
    if cfg.app.autostart_mining:
        if cfg.predictions_enabled:
            await points.start_predict(cfg)
        elif cfg.points_enabled:
            await points.start_watch(cfg)
        if cfg.drops.enabled:
            await drops.start(cfg)


def main() -> None:
    global TOKEN
    # Use the OS certificate store so HTTPS (GitHub API, Twitch GQL) works
    # reliably across machines, even in the frozen build.
    try:
        import truststore
        truststore.inject_into_ssl()
    except Exception:
        pass

    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8917)
    parser.add_argument("--token", default="dev")
    parser.add_argument("--run-miner", default=None,
                        help="internal: run the points miner child for the given config path")
    parser.add_argument("--run-drops", default=None,
                        help="internal: run the drops miner child for the given config path")
    args = parser.parse_args()

    # Child mode: run the points miner instead of the server.
    if args.run_miner:
        import runner
        runner.run(args.run_miner)
        return

    # Child mode: run the drops miner (DevilXD headless).
    if args.run_drops:
        import drops_runner
        drops_runner.run(args.run_drops)
        return

    TOKEN = args.token

    app = make_app()
    app.on_startup.append(_on_startup)
    app.on_cleanup.append(_on_cleanup)
    # Print the bound port so the parent process can read it if needed.
    print(f"TWITCH_FARMER_BACKEND_READY port={args.port}", flush=True)
    web.run_app(app, host=args.host, port=args.port, print=None)


if __name__ == "__main__":
    main()
