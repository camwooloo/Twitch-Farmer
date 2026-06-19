# -*- coding: utf-8 -*-
"""
Event hub: a tiny pub/sub used to push live events (logs, status, drop
progress, prediction events, …) from the miner engines to every connected
WebSocket client.
"""
from __future__ import annotations

import asyncio
import time
from collections import deque
from typing import Any


class Hub:
    def __init__(self, history: int = 500) -> None:
        self._subscribers: set[asyncio.Queue] = set()
        self._log_buffer: deque[dict] = deque(maxlen=history)
        self._state: dict[str, Any] = {
            "points": {"running": False, "status": "stopped"},
            "predictions": {"running": False, "status": "stopped"},
            "drops": {"running": False, "status": "stopped"},
        }
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    # ---- subscription -------------------------------------------------- #
    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    @property
    def log_history(self) -> list[dict]:
        return list(self._log_buffer)

    @property
    def state(self) -> dict:
        return self._state

    # ---- emit ---------------------------------------------------------- #
    def emit(self, kind: str, payload: Any) -> None:
        """Thread-safe broadcast. May be called from any thread."""
        event = {"kind": kind, "payload": payload, "ts": time.time()}
        if kind == "log":
            self._log_buffer.append(event)
        if self._loop is not None and not self._loop.is_closed():
            self._loop.call_soon_threadsafe(self._dispatch, event)
        else:
            self._dispatch(event)

    def set_state(self, engine: str, **updates: Any) -> None:
        self._state.setdefault(engine, {}).update(updates)
        self.emit("state", {"engine": engine, "state": self._state[engine]})

    def _dispatch(self, event: dict) -> None:
        dead = []
        for q in self._subscribers:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self._subscribers.discard(q)

    def log(self, level: str, message: str, source: str = "app") -> None:
        self.emit("log", {"level": level, "message": message, "source": source})
