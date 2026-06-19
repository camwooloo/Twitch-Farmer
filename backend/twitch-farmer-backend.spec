# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the Twitch Farmer backend (onedir).
#
# Bundles the aiohttp server, the vendored rdavydov points miner and all of its
# third-party dependencies. pandas is intentionally excluded (only the optional
# analytics server needs it) to keep the bundle small.

import os
import sys
from PyInstaller.utils.hooks import collect_all, collect_submodules

block_cipher = None
here = os.path.abspath(os.getcwd())
vendor = os.path.join(here, "vendor")
vendor_drops = os.path.join(here, "vendor_drops")
sys.path.insert(0, vendor)         # so collect_submodules can discover the points package
sys.path.insert(0, vendor_drops)   # so the drops modules are importable for analysis

datas = [
    # DevilXD translation files (drops_runner repoints LANG_PATH here)
    (os.path.join(vendor_drops, "lang"), "vendor_drops/lang"),
]
binaries = []
hiddenimports = [
    # backend + points stack
    "aiohttp", "colorama", "requests", "websocket", "emoji", "millify",
    "validators", "pytz", "flask",
    "dateutil", "dateutil.tz", "dateutil.relativedelta", "dateutil.parser",
    "irc", "irc.client", "irc.bot", "irc.connection", "irc.strings",
    # child entry points
    "runner", "drops_runner", "drops_gui",
    # drops stack (DevilXD core, imported via sys.modules['gui'] swap)
    "twitch", "inventory", "channel", "dxd_websocket", "constants", "exceptions",
    "utils", "settings", "version", "translate",
    "yarl", "PIL", "PIL.Image",
]

# emoji + irc ship data / many submodules — collect them wholesale.
for pkg in ("emoji", "irc"):
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

# the vendored points package is imported dynamically via sys.path — pull every
# submodule in so nothing is missed.
hiddenimports += collect_submodules("TwitchChannelPointsMiner")

a = Analysis(
    ["server.py"],
    pathex=[here, vendor, vendor_drops],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=["pandas", "numpy", "matplotlib", "tkinter", "PyQt5", "PySide6"],
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="twitch-farmer-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="twitch-farmer-backend",
)
