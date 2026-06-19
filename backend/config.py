# -*- coding: utf-8 -*-
"""
Configuration schema + persistence for Twitch Farmer.

A single JSON document holds *everything* the two underlying miners need.
The schema mirrors rdavydov's example.py (points / predictions / notifications)
and adds a DevilXD-style `drops` section (game selection, mine-all, exclusions).

Plain dataclasses are used (no pydantic) to keep the PyInstaller bundle small
and the freeze reliable.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field, asdict, is_dataclass, fields
from pathlib import Path
from typing import Any, Type, TypeVar, get_args, get_origin, get_type_hints, Union

T = TypeVar("T")


# --------------------------------------------------------------------------- #
# Notification providers
# --------------------------------------------------------------------------- #
ALL_EVENTS = [
    "STREAMER_ONLINE", "STREAMER_OFFLINE", "GAIN_FOR_RAID", "GAIN_FOR_CLAIM",
    "GAIN_FOR_WATCH", "GAIN_FOR_WATCH_STREAK", "BET_WIN", "BET_LOSE",
    "BET_REFUND", "BET_FILTERS", "BET_GENERAL", "BET_FAILED", "BET_START",
    "BONUS_CLAIM", "MOMENT_CLAIM", "JOIN_RAID", "DROP_CLAIM", "DROP_STATUS",
    "CHAT_MENTION",
]


@dataclass
class Telegram:
    enabled: bool = False
    chat_id: int = 0
    token: str = ""
    disable_notification: bool = True
    events: list[str] = field(default_factory=lambda: ["BET_LOSE", "CHAT_MENTION"])


@dataclass
class Discord:
    enabled: bool = False
    webhook_api: str = ""
    events: list[str] = field(default_factory=lambda: ["BET_LOSE", "CHAT_MENTION"])


@dataclass
class Webhook:
    enabled: bool = False
    endpoint: str = ""
    method: str = "GET"
    events: list[str] = field(default_factory=lambda: ["BET_LOSE", "CHAT_MENTION"])


@dataclass
class Matrix:
    enabled: bool = False
    username: str = ""
    password: str = ""
    homeserver: str = "matrix.org"
    room_id: str = ""
    events: list[str] = field(default_factory=lambda: ["BET_LOSE"])


@dataclass
class Pushover:
    enabled: bool = False
    userkey: str = ""
    token: str = ""
    priority: int = 0
    sound: str = "pushover"
    events: list[str] = field(default_factory=lambda: ["CHAT_MENTION", "DROP_CLAIM"])


@dataclass
class Gotify:
    enabled: bool = False
    endpoint: str = ""
    priority: int = 8
    events: list[str] = field(default_factory=lambda: ["BET_LOSE", "CHAT_MENTION"])


# --------------------------------------------------------------------------- #
# Logging
# --------------------------------------------------------------------------- #
@dataclass
class ColorPalette:
    STREAMER_online: str = "GREEN"
    streamer_offline: str = "RED"
    BET_win: str = "MAGENTA"


@dataclass
class LoggerSettings:
    save: bool = True
    console_level: str = "INFO"          # DEBUG / INFO / WARNING / ERROR
    console_username: bool = False
    auto_clear: bool = True
    time_zone: str = ""
    file_level: str = "DEBUG"
    emoji: bool = True
    less: bool = False
    colored: bool = True
    color_palette: ColorPalette = field(default_factory=ColorPalette)


# --------------------------------------------------------------------------- #
# Betting
# --------------------------------------------------------------------------- #
@dataclass
class FilterCondition:
    by: str = "TOTAL_USERS"      # PERCENTAGE_USERS, ODDS_PERCENTAGE, ODDS, TOP_POINTS, TOTAL_USERS, TOTAL_POINTS
    where: str = "LTE"           # GT, LT, GTE, LTE
    value: int = 800


@dataclass
class BetSettings:
    strategy: str = "SMART"      # MOST_VOTED, HIGH_ODDS, PERCENTAGE, SMART_MONEY, SMART
    percentage: int = 5
    percentage_gap: int = 20
    max_points: int = 50000
    stealth_mode: bool = True
    delay_mode: str = "FROM_END"   # FROM_START, FROM_END, PERCENTAGE
    delay: float = 6
    minimum_points: int = 0
    filter_condition: FilterCondition = field(default_factory=FilterCondition)


@dataclass
class StreamerSettings:
    make_predictions: bool = True
    follow_raid: bool = True
    claim_drops: bool = True
    claim_moments: bool = True
    watch_streak: bool = True
    community_goals: bool = False
    chat: str = "ONLINE"          # ALWAYS, NEVER, ONLINE, OFFLINE
    bet: BetSettings = field(default_factory=BetSettings)


@dataclass
class Streamer:
    username: str = ""
    display_name: str = ""
    avatar: str = ""
    # When override is False the global streamer_settings are used.
    override: bool = False
    settings: StreamerSettings = field(default_factory=StreamerSettings)


# --------------------------------------------------------------------------- #
# Drops (DevilXD style)
# --------------------------------------------------------------------------- #
@dataclass
class DropsSettings:
    enabled: bool = True
    # Ordered list of game names to prioritise. Empty + mine_all => mine everything.
    priority_games: list[str] = field(default_factory=list)
    mine_all: bool = True             # mine every available campaign, priority first
    exclude: list[str] = field(default_factory=list)
    priority_mode: str = "PRIORITY_ONLY"  # PRIORITY_ONLY, ENDING_SOONEST, LOW_AVBL_FIRST
    farm_badges: bool = True          # always include badge/emote-only campaigns
    proxy: str = ""


# --------------------------------------------------------------------------- #
# App / shell settings (UI, tray, startup)
# --------------------------------------------------------------------------- #
@dataclass
class AppSettings:
    run_on_startup: bool = False
    start_in_tray: bool = False
    minimize_to_tray: bool = True
    close_to_tray: bool = True
    theme: str = "dark"
    accent: str = "#9146FF"           # Twitch purple
    autostart_mining: bool = False    # begin mining as soon as the app launches


# --------------------------------------------------------------------------- #
# Root config
# --------------------------------------------------------------------------- #
@dataclass
class Config:
    # account
    username: str = ""
    password: str = ""
    # general points-miner behaviour
    claim_drops_startup: bool = False
    enable_analytics: bool = True       # record points-over-time series (built-in chart, no web-server)
    disable_ssl_cert_verification: bool = False
    disable_at_in_nickname: bool = False
    priority: list[str] = field(default_factory=lambda: ["STREAK", "DROPS", "ORDER"])
    # sub sections
    logger: LoggerSettings = field(default_factory=LoggerSettings)
    telegram: Telegram = field(default_factory=Telegram)
    discord: Discord = field(default_factory=Discord)
    webhook: Webhook = field(default_factory=Webhook)
    matrix: Matrix = field(default_factory=Matrix)
    pushover: Pushover = field(default_factory=Pushover)
    gotify: Gotify = field(default_factory=Gotify)
    streamer_settings: StreamerSettings = field(default_factory=StreamerSettings)
    streamers: list[Streamer] = field(default_factory=list)
    followers: bool = False
    followers_order: str = "ASC"      # ASC / DESC
    drops: DropsSettings = field(default_factory=DropsSettings)
    app: AppSettings = field(default_factory=AppSettings)

    # which engines are enabled (used by the unified "start all")
    points_enabled: bool = True
    predictions_enabled: bool = False


# --------------------------------------------------------------------------- #
# (De)serialisation helpers — recursive dataclass <- dict
# --------------------------------------------------------------------------- #
def _from_dict(cls: Type[T], data: Any) -> T:
    """Recursively build a dataclass from a (possibly partial) dict.

    Uses get_type_hints so that string annotations (from
    `from __future__ import annotations`) resolve to real types.
    """
    if not is_dataclass(cls):
        return data
    if not isinstance(data, dict):
        return cls()  # type: ignore[call-arg]
    hints = get_type_hints(cls)
    kwargs: dict[str, Any] = {}
    for f in fields(cls):
        if f.name not in data:
            continue
        value = data[f.name]
        ftype = hints.get(f.name, f.type)
        origin = get_origin(ftype)
        if is_dataclass(ftype):
            kwargs[f.name] = _from_dict(ftype, value)
        elif origin in (list, tuple) and value is not None:
            args = get_args(ftype)
            inner = args[0] if args else Any
            if is_dataclass(inner):
                kwargs[f.name] = [_from_dict(inner, v) for v in value]
            else:
                kwargs[f.name] = value
        else:
            kwargs[f.name] = value
    return cls(**kwargs)  # type: ignore[arg-type]


def data_dir() -> Path:
    """%APPDATA%/TwitchFarmer on Windows, ~/.twitch-farmer elsewhere."""
    base = os.environ.get("APPDATA")
    if base:
        p = Path(base) / "TwitchFarmer"
    else:
        p = Path.home() / ".twitch-farmer"
    p.mkdir(parents=True, exist_ok=True)
    return p


def config_path() -> Path:
    return data_dir() / "config.json"


def load_config() -> Config:
    path = config_path()
    if path.exists():
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            return _from_dict(Config, raw)
        except Exception:
            pass
    return Config()


def save_config(cfg: Config) -> None:
    config_path().write_text(
        json.dumps(asdict(cfg), indent=2, ensure_ascii=False), encoding="utf-8"
    )


def config_to_dict(cfg: Config) -> dict:
    return asdict(cfg)
