# -*- coding: utf-8 -*-
"""
Miner engine managers.

PointsEngine is a supervisor over ONE rdavydov child process with two intent
flags — `watch` (Points) and `predict` (Predictions). Predictions require
watching, so enabling predictions also enables watching; the child is restarted
when the betting state needs to change. This exposes three independent controls
to the UI: Points, Predictions, Drops.

DropsEngine runs the headless DevilXD core as a child process and seeds its
cookie jar from the points login first (single sign-on).
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from dataclasses import asdict
from typing import Optional

from hub import Hub
import config as cfgmod
from config import Config
import token_bridge

ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")
EVT_MARK = "\x01EVT\x01"
SPADE_RE = re.compile(r"spade\.twitch\.tv", re.IGNORECASE)
# e.g. "Streamer(username=jynxzi, channel_id=411377640, channel_points=448.83k) is Online!"
STREAMER_RE = re.compile(
    r"Streamer\(username=([\w]+).*?channel_points=([\d.,]+\w?)\)\s*is\s*(Online|Offline)",
    re.IGNORECASE,
)
GAIN_RE = re.compile(r"username=([\w]+).*?(\+\d[\d,]*)\s*→\s*([\d.,]+\w?)")
# rdavydov prints the TV login URL and code on separate lines
LOGIN_URI_RE = re.compile(r"(https?://\S*twitch\.tv/activate\S*)", re.IGNORECASE)
LOGIN_CODE_RE = re.compile(r"enter this code:\s*([A-Za-z0-9]+)", re.IGNORECASE)
LOGIN_OK_RE = re.compile(r"Loading data for|Login successful|Welcome", re.IGNORECASE)


def _child_command(flag: str, config_path: str) -> list[str]:
    if getattr(sys, "frozen", False):
        return [sys.executable, flag, config_path]
    server = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server.py")
    return [sys.executable, server, flag, config_path]


def _spawn_env() -> dict:
    return dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8")


_CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0


class PointsEngine:
    """Supervises one points-miner child; tracks watch + predict intent."""

    name = "points"

    def __init__(self, hub: Hub) -> None:
        self.hub = hub
        self._proc: Optional[asyncio.subprocess.Process] = None
        self._reader: Optional[asyncio.Task] = None
        self._watch = False
        self._predict = False
        self._launched_predict = False  # predict state of the running child
        self._spade_warned = False
        self._login_uri = "https://www.twitch.tv/activate"

    @property
    def running(self) -> bool:
        return self._proc is not None and self._proc.returncode is None

    # ---- public controls ---------------------------------------------- #
    async def start_watch(self, cfg: Config) -> None:
        self._watch = True
        await self._reconcile(cfg)

    async def stop_watch(self) -> None:
        # stopping the watcher stops everything (predictions need watching)
        self._watch = False
        self._predict = False
        await self._reconcile(None)

    async def start_predict(self, cfg: Config) -> None:
        self._predict = True
        self._watch = True
        await self._reconcile(cfg)

    async def stop_predict(self, cfg: Config) -> None:
        self._predict = False
        await self._reconcile(cfg)

    # ---- reconcile ----------------------------------------------------- #
    async def _reconcile(self, cfg: Optional[Config]) -> None:
        desired_running = self._watch or self._predict
        if not desired_running:
            await self._stop_proc()
            self._publish()
            return
        if cfg is None:
            cfg = cfgmod.load_config()
        if not cfg.username:
            self.hub.log("error", "Set your Twitch username in Settings first", self.name)
            self._watch = self._predict = False
            self.hub.set_state("points", running=False, status="error")
            self.hub.set_state("predictions", running=False, status="error")
            return
        if not self.running:
            await self._launch(cfg)
        elif self._launched_predict != self._predict:
            # betting state changed — restart the child
            self.hub.log(
                "info",
                f"{'Enabling' if self._predict else 'Disabling'} predictions — restarting watcher",
                self.name,
            )
            await self._stop_proc()
            await self._launch(cfg)
        self._publish()

    async def _launch(self, cfg: Config) -> None:
        self.hub.set_state("points", running=True, status="starting")
        run_cfg = cfgmod.data_dir() / "run_config.json"
        data = asdict(cfg)
        data["_predictions"] = self._predict
        run_cfg.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

        cmd = _child_command("--run-miner", str(run_cfg))
        try:
            self._proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(cfgmod.data_dir()),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                creationflags=_CREATE_NO_WINDOW,
                env=_spawn_env(),
            )
        except Exception as exc:  # noqa: BLE001
            self.hub.log("error", f"Failed to launch points miner: {exc}", self.name)
            self.hub.set_state("points", running=False, status="error")
            return
        self._launched_predict = self._predict
        self._spade_warned = False
        self.hub.set_state("points", status="running")
        self.hub.log(
            "info",
            f"Points miner started for {cfg.username}"
            + (" with predictions" if self._predict else ""),
            self.name,
        )
        self._reader = asyncio.create_task(self._pump())

    async def _pump(self) -> None:
        assert self._proc and self._proc.stdout
        try:
            async for raw in self._proc.stdout:
                line = ANSI_RE.sub("", raw.decode("utf-8", "replace")).rstrip()
                if not line:
                    continue
                self._detect_spade(line)
                self._detect_streamer(line)
                self._detect_login(line)
                low = line.lower()
                level = "info"
                if "error" in low or "exception" in low or "traceback" in low:
                    level = "error"
                elif "warning" in low:
                    level = "warning"
                self.hub.log(level, line, self.name)
        except asyncio.CancelledError:
            raise
        finally:
            rc = await self._proc.wait()
            self.hub.set_state("points", running=False, status="stopped")
            self.hub.set_state("predictions", running=False, status="stopped")
            self.hub.log("info", f"Points miner exited (code {rc})", self.name)

    def _detect_streamer(self, line: str) -> None:
        m = STREAMER_RE.search(line)
        if m:
            self.hub.emit("points_event", {
                "type": "status",
                "username": m.group(1).lower(),
                "points": m.group(2),
                "online": m.group(3).lower() == "online",
            })
            return
        g = GAIN_RE.search(line)
        if g:
            self.hub.emit("points_event", {
                "type": "points",
                "username": g.group(1).lower(),
                "points": g.group(3),
            })

    def _detect_login(self, line: str) -> None:
        u = LOGIN_URI_RE.search(line)
        if u:
            self._login_uri = u.group(1)
        c = LOGIN_CODE_RE.search(line)
        if c:
            self.hub.emit("login", {"engine": "points", "uri": self._login_uri, "code": c.group(1)})
            return
        if LOGIN_OK_RE.search(line):
            self.hub.emit("login_ok", {"engine": "points"})

    def _detect_spade(self, line: str) -> None:
        if self._spade_warned:
            return
        if SPADE_RE.search(line) and ("getaddrinfo failed" in line or "Failed to resolve" in line):
            self._spade_warned = True
            self.hub.emit("spade_blocked", True)
            self.hub.log(
                "warning",
                "spade.twitch.tv (Twitch's watch-time tracker) can't be resolved — it's likely "
                "blocked by a DNS ad-blocker (Pi-hole / AdGuard / NextDNS). Whitelist it so "
                "watch-time points are credited.",
                self.name,
            )

    async def _stop_proc(self) -> None:
        if not self.running:
            return
        assert self._proc is not None
        try:
            self._proc.terminate()
            try:
                await asyncio.wait_for(self._proc.wait(), timeout=10)
            except asyncio.TimeoutError:
                self._proc.kill()
        except ProcessLookupError:
            pass
        if self._reader:
            self._reader.cancel()
        self._proc = None

    def _publish(self) -> None:
        run = self.running
        self.hub.set_state("points", running=run, status="running" if run else "stopped")
        self.hub.set_state(
            "predictions",
            running=run and self._predict,
            status="running" if (run and self._predict) else "stopped",
        )


class DropsEngine:
    name = "drops"

    def __init__(self, hub: Hub) -> None:
        self.hub = hub
        self._proc: Optional[asyncio.subprocess.Process] = None
        self._reader: Optional[asyncio.Task] = None

    @property
    def running(self) -> bool:
        return self._proc is not None and self._proc.returncode is None

    async def start(self, cfg: Config) -> None:
        if self.running:
            self.hub.log("warning", "Drops miner already running", self.name)
            return
        self.hub.set_state(self.name, running=True, status="starting")

        # Single sign-on: reuse the points login if available.
        try:
            if token_bridge.seed_drops_from_points(cfg.username):
                self.hub.log("info", "Reusing your existing Twitch login for drops", self.name)
        except Exception:
            pass

        run_cfg = cfgmod.data_dir() / "run_config.json"
        run_cfg.write_text(json.dumps(asdict(cfg), ensure_ascii=False), encoding="utf-8")

        cmd = _child_command("--run-drops", str(run_cfg))
        try:
            self._proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(cfgmod.data_dir()),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                creationflags=_CREATE_NO_WINDOW,
                env=_spawn_env(),
            )
        except Exception as exc:  # noqa: BLE001
            self.hub.log("error", f"Failed to launch drops miner: {exc}", self.name)
            self.hub.set_state(self.name, running=False, status="error")
            return

        mode = "all games" if cfg.drops.mine_all else f"{len(cfg.drops.priority_games)} game(s)"
        self.hub.set_state(self.name, status="running")
        self.hub.log("info", f"Drops miner started — mining {mode}", self.name)
        self._reader = asyncio.create_task(self._pump())

    async def _pump(self) -> None:
        assert self._proc and self._proc.stdout
        try:
            async for raw in self._proc.stdout:
                line = ANSI_RE.sub("", raw.decode("utf-8", "replace")).rstrip()
                if not line:
                    continue
                if EVT_MARK in line:
                    self._handle_event(line.split(EVT_MARK, 1)[1])
                else:
                    self.hub.log("info", line, self.name)
        except asyncio.CancelledError:
            raise
        finally:
            rc = await self._proc.wait()
            self.hub.set_state(self.name, running=False, status="stopped")
            self.hub.log("info", f"Drops miner exited (code {rc})", self.name)

    def _handle_event(self, payload: str) -> None:
        try:
            evt = json.loads(payload)
        except json.JSONDecodeError:
            return
        kind = evt.get("evt")
        if kind == "login_code":
            self.hub.emit("login", {"engine": "drops", "uri": evt.get("uri"), "code": evt.get("code")})
            self.hub.log(
                "warning",
                f"🔑 Login required — open {evt.get('uri')} and enter code {evt.get('code')}",
                self.name,
            )
        elif kind == "login_state" and evt.get("user"):
            self.hub.emit("login_ok", {"engine": "drops"})
        elif kind == "status":
            self.hub.set_state(self.name, status=str(evt.get("text", "running")))
        elif kind == "notify":
            self.hub.log("info", str(evt.get("message", "")), self.name)
        self.hub.emit("drops_event", evt)

    async def stop(self) -> None:
        if not self.running:
            return
        self.hub.set_state(self.name, status="stopping")
        assert self._proc is not None
        try:
            self._proc.terminate()
            try:
                await asyncio.wait_for(self._proc.wait(), timeout=10)
            except asyncio.TimeoutError:
                self._proc.kill()
        except ProcessLookupError:
            pass
        if self._reader:
            self._reader.cancel()
        self.hub.set_state(self.name, running=False, status="stopped")
