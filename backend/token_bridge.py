# -*- coding: utf-8 -*-
"""
Single-login bridge between the two engines.

The points miner (rdavydov) and the drops miner (DevilXD) now use the *same*
Twitch client-id (the Smart-TV id `ue6666...`), so one OAuth token is valid for
both. This module copies the points miner's saved token into the drops miner's
cookie jar so the user only logs in once.

Storage formats:
  * points: pickle list of {"name","value"} cookies at
    `<data>/cookies/<username>.pkl` (token under name "auth-token")
  * drops:  aiohttp CookieJar at `<data>/drops/cookies.jar`
    (token under cookie "auth-token" for the SMARTBOX client URL)
"""
from __future__ import annotations

import pickle
from pathlib import Path
from typing import Optional

import config as cfgmod

SMARTBOX_URL = "https://android.tv.twitch.tv"


def _points_pickle(username: str) -> Path:
    return cfgmod.data_dir() / "cookies" / f"{username}.pkl"


def _drops_jar() -> Path:
    return cfgmod.data_dir() / "drops" / "cookies.jar"


def read_points_token(username: str) -> Optional[str]:
    p = _points_pickle(username)
    if not username or not p.exists():
        return None
    try:
        with open(p, "rb") as fh:
            cookies = pickle.load(fh)
        for c in cookies:
            if c.get("name") == "auth-token" and c.get("value"):
                return c["value"]
    except Exception:
        pass
    return None


def _drops_jar_has_token() -> bool:
    jar_p = _drops_jar()
    if not jar_p.exists():
        return False
    try:
        from aiohttp import CookieJar
        from yarl import URL

        jar = CookieJar()
        jar.load(jar_p)
        ck = jar.filter_cookies(URL(SMARTBOX_URL))
        return "auth-token" in ck and bool(ck["auth-token"].value)
    except Exception:
        return False


def seed_drops_from_points(username: str) -> bool:
    """Copy the points token into the drops cookie jar if drops has none yet.

    Returns True if a token was seeded.
    """
    if _drops_jar_has_token():
        return False
    token = read_points_token(username)
    if not token:
        return False
    try:
        from aiohttp import CookieJar
        from yarl import URL

        jar_p = _drops_jar()
        jar_p.parent.mkdir(parents=True, exist_ok=True)
        jar = CookieJar()
        if jar_p.exists():
            try:
                jar.load(jar_p)
            except Exception:
                pass
        jar.update_cookies({"auth-token": token}, response_url=URL(SMARTBOX_URL))
        jar.save(jar_p)
        return True
    except Exception:
        return False


def has_any_login(username: str) -> bool:
    return bool(read_points_token(username)) or _drops_jar_has_token()
