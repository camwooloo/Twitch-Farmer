# -*- coding: utf-8 -*-
"""
Drops-miner child entry point (DevilXD core, headless).

Invoked as ``backend --run-drops <config.json>``. It:
  1. redirects DevilXD's working-dir paths into %APPDATA%/TwitchFarmer/drops
  2. installs the headless GUIManager (drops_gui) in place of the tkinter one
  3. builds a DevilXD Settings object from our config
  4. runs the async Twitch client until the process is terminated

Structured progress is emitted on stdout as ``\x01EVT\x01{json}`` lines by
drops_gui; everything else printed is treated as a plain log line by the parent.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys


def _base_dir() -> str:
    return getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))


def _vendor_path() -> str:
    return os.path.join(_base_dir(), "vendor_drops")


def run(config_path: str) -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
        except Exception:
            pass

    # OS cert store for reliable HTTPS across machines (matches DevilXD's main.py)
    try:
        import truststore
        truststore.inject_into_ssl()
    except Exception:
        pass

    sys.path.insert(0, _vendor_path())

    with open(config_path, "r", encoding="utf-8") as fh:
        cfg = json.load(fh)
    drops_cfg = cfg.get("drops", {})

    # --- working directory for DevilXD state ---
    appdata = os.environ.get("APPDATA") or os.path.expanduser("~")
    work = os.path.join(appdata, "TwitchFarmer", "drops")
    os.makedirs(os.path.join(work, "cache"), exist_ok=True)

    # --- patch constants paths BEFORE importing settings/twitch/translate ---
    import constants
    from pathlib import Path

    constants.SETTINGS_PATH = Path(work, "settings.json")
    constants.CACHE_PATH = Path(work, "cache")
    constants.CACHE_DB = Path(work, "cache", "mapping.json")
    constants.COOKIES_PATH = Path(work, "cookies.jar")
    constants.LOG_PATH = Path(work, "log.txt")
    constants.LOCK_PATH = Path(work, "lock.file")
    constants.DUMP_PATH = Path(work, "dump.dat")
    constants.LANG_PATH = Path(_vendor_path(), "lang")

    from constants import PriorityMode
    from yarl import URL

    # --- install headless GUI before importing twitch ---
    import drops_gui
    sys.modules["gui"] = drops_gui

    from settings import Settings
    from twitch import Twitch
    from exceptions import ExitRequest, ReloadRequest
    from translate import _  # noqa: F401  (ensures lang loads cleanly)

    # --- fake CLI args (Settings reads these before the settings file) ---
    from types import SimpleNamespace
    args = SimpleNamespace(
        log=False,
        tray=False,
        dump=False,
        debug_ws=0,
        debug_gql=0,
        logging_level=logging.INFO,
    )

    settings = Settings(args)
    # file-backed settings, taken from our config
    settings.priority = list(drops_cfg.get("priority_games", []))
    settings.exclude = set(drops_cfg.get("exclude", []))
    settings.enable_badges_emotes = bool(drops_cfg.get("farm_badges", True))
    settings.available_drops_check = bool(drops_cfg.get("mine_all", True))
    settings.connection_quality = 1
    settings.proxy = URL(drops_cfg.get("proxy", "") or "")

    # Reconcile mine_all with priority_mode: PRIORITY_ONLY restricts mining to the
    # priority list, which contradicts "mine all". When mining everything, fall
    # back to an all-games ordering (ending soonest by default).
    mine_all = bool(drops_cfg.get("mine_all", True))
    if mine_all:
        mode = drops_cfg.get("priority_mode", "ENDING_SOONEST")
        if mode == "PRIORITY_ONLY":
            mode = "ENDING_SOONEST"
        settings.priority_mode = getattr(PriorityMode, mode, PriorityMode.ENDING_SOONEST)
    else:
        settings.priority_mode = PriorityMode.PRIORITY_ONLY

    logging.basicConfig(level=logging.INFO, format="%(message)s", stream=sys.stdout)

    async def amain() -> None:
        client = Twitch(settings)
        try:
            await client.run()
        except (ExitRequest, ReloadRequest):
            pass
        except KeyboardInterrupt:
            pass
        finally:
            try:
                await client.shutdown()
            except Exception:
                pass

    try:
        asyncio.run(amain())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    run(sys.argv[1])
