# -*- coding: utf-8 -*-
"""
Points-miner child entry point.

Invoked as a *separate process* (`backend --run-miner <config.json>`) so that
rdavydov's TwitchChannelPointsMiner runs in a real main thread — it installs
OS signal handlers and calls sys.exit(), neither of which is safe inside the
server's event loop or a worker thread.

stdout/stderr of this process are piped back to the parent, which forwards
them to the UI as live logs.
"""
from __future__ import annotations

import json
import logging
import os
import sys


def _vendor_path() -> str:
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, "vendor")


def _level(name: str) -> int:
    return getattr(logging, str(name).upper(), logging.INFO)


def run(config_path: str) -> None:
    # Ensure UTF-8 output regardless of the host console code page.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
        except Exception:
            pass

    sys.path.insert(0, _vendor_path())

    with open(config_path, "r", encoding="utf-8") as fh:
        cfg = json.load(fh)

    # The supervisor decides whether this run should place predictions. Force the
    # make_predictions flag everywhere so the Points/Predictions split is honoured.
    force_predictions = cfg.get("_predictions", cfg["streamer_settings"]["make_predictions"])
    cfg["streamer_settings"]["make_predictions"] = bool(force_predictions)
    for _s in cfg.get("streamers", []):
        if isinstance(_s, dict) and "settings" in _s:
            _s["settings"]["make_predictions"] = bool(force_predictions)

    from TwitchChannelPointsMiner import TwitchChannelPointsMiner
    from TwitchChannelPointsMiner.logger import LoggerSettings, ColorPalette
    from TwitchChannelPointsMiner.classes.Chat import ChatPresence
    from TwitchChannelPointsMiner.classes.Discord import Discord
    from TwitchChannelPointsMiner.classes.Webhook import Webhook
    from TwitchChannelPointsMiner.classes.Telegram import Telegram
    from TwitchChannelPointsMiner.classes.Matrix import Matrix
    from TwitchChannelPointsMiner.classes.Pushover import Pushover
    from TwitchChannelPointsMiner.classes.Gotify import Gotify
    from TwitchChannelPointsMiner.classes.Settings import Priority, Events, FollowersOrder
    from TwitchChannelPointsMiner.classes.entities.Bet import (
        Strategy, BetSettings, Condition, OutcomeKeys, FilterCondition, DelayMode,
    )
    from TwitchChannelPointsMiner.classes.entities.Streamer import (
        Streamer, StreamerSettings,
    )

    def events(names):
        out = []
        for n in names or []:
            ev = getattr(Events, n, None)
            if ev is not None:
                out.append(ev)
        return out

    def build_bet(b):
        return BetSettings(
            strategy=getattr(Strategy, b["strategy"], Strategy.SMART),
            percentage=b["percentage"],
            percentage_gap=b["percentage_gap"],
            max_points=b["max_points"],
            stealth_mode=b["stealth_mode"],
            delay_mode=getattr(DelayMode, b["delay_mode"], DelayMode.FROM_END),
            delay=b["delay"],
            minimum_points=b["minimum_points"],
            filter_condition=FilterCondition(
                by=getattr(OutcomeKeys, b["filter_condition"]["by"], OutcomeKeys.TOTAL_USERS),
                where=getattr(Condition, b["filter_condition"]["where"], Condition.LTE),
                value=b["filter_condition"]["value"],
            ),
        )

    def build_streamer_settings(s):
        return StreamerSettings(
            make_predictions=s["make_predictions"],
            follow_raid=s["follow_raid"],
            claim_drops=s["claim_drops"],
            claim_moments=s["claim_moments"],
            watch_streak=s["watch_streak"],
            community_goals=s["community_goals"],
            chat=getattr(ChatPresence, s["chat"], ChatPresence.ONLINE),
            bet=build_bet(s["bet"]),
        )

    # --- notifications ---
    log_cfg = cfg["logger"]
    notif = {}
    if cfg["telegram"]["enabled"]:
        t = cfg["telegram"]
        notif["telegram"] = Telegram(
            chat_id=t["chat_id"], token=t["token"],
            events=events(t["events"]), disable_notification=t["disable_notification"],
        )
    if cfg["discord"]["enabled"]:
        d = cfg["discord"]
        notif["discord"] = Discord(webhook_api=d["webhook_api"], events=events(d["events"]))
    if cfg["webhook"]["enabled"]:
        w = cfg["webhook"]
        notif["webhook"] = Webhook(endpoint=w["endpoint"], method=w["method"], events=events(w["events"]))
    if cfg["matrix"]["enabled"]:
        m = cfg["matrix"]
        notif["matrix"] = Matrix(
            username=m["username"], password=m["password"], homeserver=m["homeserver"],
            room_id=m["room_id"], events=events(m["events"]),
        )
    if cfg["pushover"]["enabled"]:
        p = cfg["pushover"]
        notif["pushover"] = Pushover(
            userkey=p["userkey"], token=p["token"], priority=p["priority"],
            sound=p["sound"], events=events(p["events"]),
        )
    if cfg["gotify"]["enabled"]:
        g = cfg["gotify"]
        notif["gotify"] = Gotify(endpoint=g["endpoint"], priority=g["priority"], events=events(g["events"]))

    cp = log_cfg["color_palette"]
    logger_settings = LoggerSettings(
        save=log_cfg["save"],
        console_level=_level(log_cfg["console_level"]),
        console_username=log_cfg["console_username"],
        auto_clear=log_cfg["auto_clear"],
        time_zone=log_cfg["time_zone"],
        file_level=_level(log_cfg["file_level"]),
        emoji=log_cfg["emoji"],
        less=log_cfg["less"],
        colored=log_cfg["colored"],
        color_palette=ColorPalette(
            STREAMER_online=cp["STREAMER_online"],
            streamer_offline=cp["streamer_offline"],
            BET_win=cp["BET_win"],
        ),
        **notif,
    )

    priority = [getattr(Priority, p, Priority.STREAK) for p in cfg["priority"]]

    miner = TwitchChannelPointsMiner(
        username=cfg["username"],
        password=cfg["password"] or None,
        claim_drops_startup=cfg["claim_drops_startup"],
        enable_analytics=cfg["enable_analytics"],
        disable_ssl_cert_verification=cfg["disable_ssl_cert_verification"],
        disable_at_in_nickname=cfg["disable_at_in_nickname"],
        priority=priority,
        logger_settings=logger_settings,
        streamer_settings=build_streamer_settings(cfg["streamer_settings"]),
    )

    # Analytics data is recorded to JSON automatically when enable_analytics is
    # set (see TwitchChannelPointsMiner.__init__). We deliberately do NOT start
    # the Flask web-server — Twitch Farmer reads the JSON and charts it natively.

    streamers = []
    for s in cfg["streamers"]:
        if s.get("override"):
            streamers.append(Streamer(s["username"], settings=build_streamer_settings(s["settings"])))
        else:
            streamers.append(Streamer(s["username"]))

    miner.mine(
        streamers,
        followers=cfg["followers"],
        followers_order=getattr(FollowersOrder, cfg["followers_order"], FollowersOrder.ASC),
    )


if __name__ == "__main__":
    run(sys.argv[1])
