# -*- coding: utf-8 -*-
"""
Headless replacement for DevilXD's tkinter GUIManager.

It implements the exact surface the Twitch core calls (status / tray / progress /
inventory / channels / websockets / login) but, instead of drawing widgets,
emits newline-delimited JSON events on stdout. The parent backend process reads
those and forwards them to the UI over the WebSocket.

Installed via ``sys.modules['gui'] = this_module`` before importing ``twitch``.
"""
from __future__ import annotations

import asyncio
import json
import sys
from typing import Any

from exceptions import ExitRequest


def emit(evt: str, **data: Any) -> None:
    try:
        sys.stdout.write("\x01EVT\x01" + json.dumps({"evt": evt, **data}) + "\n")
        sys.stdout.flush()
    except Exception:
        pass


def _g(obj: Any, *names: str, default: Any = None) -> Any:
    for n in names:
        if hasattr(obj, n):
            try:
                return getattr(obj, n)
            except Exception:
                continue
    return default


def _game_name(obj: Any) -> str | None:
    game = _g(obj, "game")
    if game is None:
        return None
    return _g(game, "name", default=str(game))


def _iso(dt: Any) -> str:
    try:
        return dt.isoformat()
    except Exception:
        return ""


def _benefit_category(benefits: Any) -> str:
    """badge / emote / reward, based on DevilXD's BenefitType."""
    types = set()
    for b in benefits or []:
        t = _g(b, "type")
        val = str(_g(t, "value", default=t) or "").upper()
        types.add(val)
    if "BADGE" in types:
        return "badge"
    if "EMOTE" in types:
        return "emote"
    return "reward"


# --------------------------------------------------------------------------- #
# sub components
# --------------------------------------------------------------------------- #
class StatusBar:
    def __init__(self, manager, *_a, **_k):
        self._m = manager

    def update(self, text: str, *_a, **_k):
        emit("status", text=str(text))


class TrayIcon:
    def __init__(self, manager, *_a, **_k):
        self._m = manager

    def change_icon(self, state: str = "idle", *_a, **_k):
        emit("tray", icon=str(state))

    def notify(self, message: str, title: str | None = None, *_a, **_k):
        emit("notify", message=str(message), title=title)

    def update_title(self, drop=None, *_a, **_k):
        pass

    def start(self):
        pass

    def stop(self):
        pass

    def restore(self):
        pass


class CampaignProgress:
    def __init__(self, manager, *_a, **_k):
        self._m = manager

    def start_timer(self):
        pass

    def stop_timer(self):
        pass

    def minute_almost_done(self):
        pass

    def display(self, drop=None, *, countdown: bool = True, subone: bool = False):
        if drop is None:
            emit("drop_clear")
            return
        emit(
            "drop",
            name=_drop_text(drop),
            current=_g(drop, "current_minutes", default=0),
            required=_g(drop, "required_minutes", default=0),
            progress=round(float(_g(drop, "progress", default=0.0)), 4),
            game=_game_name(_g(drop, "campaign")),
        )


def _drop_text(drop) -> str:
    try:
        return drop.rewards_text()
    except Exception:
        return _g(drop, "name", default="drop")


class InventoryOverview:
    def __init__(self, manager, *_a, **_k):
        self._m = manager

    def clear(self):
        emit("inv_clear")

    async def add_campaign(self, campaign):
        # DevilXD wraps this in asyncio.create_task(), so it must be a coroutine.
        drops = []
        for d in _g(campaign, "drops", default=[]) or []:
            benefits = _g(d, "benefits", default=[]) or []
            drops.append({
                "name": _drop_text(d),
                "current": _g(d, "current_minutes", default=0),
                "required": _g(d, "required_minutes", default=0),
                "claimed": bool(_g(d, "is_claimed", default=False)),
                "image": str(_g(benefits[0], "image_url", default="")) if benefits else "",
                "category": _benefit_category(benefits),
            })
        game = _g(campaign, "game")
        emit(
            "campaign",
            id=_g(campaign, "id", default=""),
            name=_g(campaign, "name", default=""),
            game=_game_name(campaign),
            game_id=str(_g(game, "id", default="")),
            image=str(_g(campaign, "image_url", default="")),
            link_url=str(_g(campaign, "link_url", default="")),
            ends_at=_iso(_g(campaign, "ends_at")),
            claimed=_g(campaign, "claimed_drops", default=0),
            total=_g(campaign, "total_drops", default=len(drops)),
            active=bool(_g(campaign, "active", default=False)),
            finished=bool(_g(campaign, "finished", default=False)),
            linked=bool(_g(campaign, "linked", default=True)),
            drops=drops,
        )

    def update_drop(self, drop):
        emit(
            "drop_update",
            campaign=_g(_g(drop, "campaign"), "id", default=""),
            name=_drop_text(drop),
            current=_g(drop, "current_minutes", default=0),
            required=_g(drop, "required_minutes", default=0),
            claimed=bool(_g(drop, "is_claimed", default=False)),
        )


class ChannelList:
    def __init__(self, manager, *_a, **_k):
        self._m = manager

    def clear(self):
        emit("channels_clear")

    def display(self, channel, *, add: bool = False):
        emit(
            "channel",
            name=_g(channel, "name", "display_name", default=""),
            game=_game_name(channel),
            online=bool(_g(channel, "online", default=False)),
            viewers=_g(channel, "viewers", default=0),
        )

    def set_watching(self, channel):
        emit(
            "watching",
            channel=_g(channel, "display_name", "name", default=""),
            game=_game_name(channel),
        )

    def clear_watching(self):
        emit("watching", channel=None, game=None)

    def get_selection(self):
        return None

    def clear_selection(self):
        pass


class WebsocketStatus:
    def __init__(self, manager, *_a, **_k):
        self._m = manager

    def update(self, idx: int, status=None, topics=None, *_a, **_k):
        emit("ws", idx=idx, status=status, topics=topics)

    def remove(self, idx: int, *_a, **_k):
        emit("ws_remove", idx=idx)


class _LoginData:
    def __init__(self, username="", password="", token=""):
        self.username = username
        self.password = password
        self.token = token


class LoginForm:
    def __init__(self, manager, *_a, **_k):
        self._m = manager

    async def ask_enter_code(self, verification_uri: str, user_code: str):
        emit("login_code", uri=str(verification_uri), code=str(user_code))

    def update(self, text: str, user_id=None, *_a, **_k):
        emit("login_state", text=str(text), user=user_id)

    async def ask_login(self) -> _LoginData:
        # Username/password passport flow is not supported headless — device-code
        # OAuth is used instead. If we ever reach here, fail clearly.
        emit("login_state", text="Interactive password login is not supported; use the device code.", user=None)
        raise ExitRequest()

    def clear(self, **_k):
        pass


# --------------------------------------------------------------------------- #
# manager
# --------------------------------------------------------------------------- #
class GUIManager:
    def __init__(self, twitch):
        self._twitch = twitch
        self._close_requested = asyncio.Event()
        self.status = StatusBar(self)
        self.tray = TrayIcon(self)
        self.progress = CampaignProgress(self)
        self.inv = InventoryOverview(self)
        self.channels = ChannelList(self)
        self.websockets = WebsocketStatus(self)
        self.login = LoginForm(self)

    # lifecycle ---------------------------------------------------------- #
    @property
    def running(self) -> bool:
        return not self._close_requested.is_set()

    @property
    def close_requested(self) -> bool:
        return self._close_requested.is_set()

    def start(self):
        emit("status", text="Drops miner starting")

    def stop(self):
        pass

    def close(self, *args) -> int:
        self._close_requested.set()
        try:
            self._twitch.close()
        except Exception:
            pass
        return 0

    def close_window(self):
        pass

    async def wait_until_closed(self):
        await self._close_requested.wait()

    async def coro_unless_closed(self, coro):
        tasks = [
            asyncio.ensure_future(coro),
            asyncio.ensure_future(self._close_requested.wait()),
        ]
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
        if self._close_requested.is_set():
            raise ExitRequest()
        return await next(iter(done))

    def prevent_close(self):
        self._close_requested.clear()

    def grab_attention(self, *, sound: bool = True):
        pass

    def save(self, *, force: bool = False) -> None:
        pass

    # display passthroughs ---------------------------------------------- #
    def set_games(self, games) -> None:
        emit("games", games=sorted(_g(g, "name", default=str(g)) for g in games))

    def display_drop(self, drop, *, countdown: bool = True, subone: bool = False) -> None:
        self.progress.display(drop, countdown=countdown, subone=subone)

    def clear_drop(self):
        self.progress.display(None)

    def print(self, message: str):
        try:
            sys.stdout.write(str(message) + "\n")
            sys.stdout.flush()
        except Exception:
            pass
