# Twitch Farmer

A beautiful Windows desktop app that farms **Twitch channel points** (watch
streaks, raids, predictions/bets, moments) **and Twitch drops** (campaign
farming with game selection, badges & emotes) — with run-on-startup, start-in-tray
and a one-click installer.

It wraps two proven open-source miners behind one polished UI:

- **Points & predictions** — [rdavydov/Twitch-Channel-Points-Miner-v2](https://github.com/rdavydov/Twitch-Channel-Points-Miner-v2) (GPLv3)
- **Drops campaigns** — [DevilXD/TwitchDropsMiner](https://github.com/DevilXD/TwitchDropsMiner) (GPLv3), run **headless** (its tkinter GUI is replaced by an event adapter)

## Features

- 🎛 **Full configuration UI** — account, streamer list, per-streamer overrides,
  betting strategies & filters, watch-streak/raids/moments, six notification
  providers (Telegram, Discord, Webhook, Matrix, Pushover, Gotify), logging.
- 🎁 **Drops farming** — pick priority games or mine *all* available campaigns,
  exclude games, live campaign / drop / badge & emote progress.
- 🔑 **Device-code login** — no password needed; open the activation page and
  enter the code shown in-app.
- 🪟 **System tray** — close/minimize to tray, restore on click, quit.
- 🚀 **Run on Windows startup** and **start in tray** (start hidden, keep mining).
- 🎨 Modern dark UI with selectable accent colour.
- 📦 **One-file installer** (NSIS), installs per-user (no admin required).

## How it works

```
┌────────────────────────────────────────────────────────────┐
│  Tauri shell (Rust)                                          │
│  • system tray · autostart · single-instance · window state │
│  • spawns + supervises the backend on a random localhost     │
│    port with a per-session token                             │
└───────────────┬──────────────────────────┬─────────────────┘
                │ WebView2 (React UI)       │ stdin/stdout
                │  HTTP + WebSocket          ▼
                ▼                  ┌──────────────────────────┐
        http://127.0.0.1:<port>   │  Python backend (frozen)  │
                                  │  aiohttp REST + WebSocket  │
                                  │  ├─ points: rdavydov miner │
                                  │  │   (child process)       │
                                  │  └─ drops: DevilXD core    │
                                  │      headless (child proc) │
                                  └──────────────────────────┘
```

Each miner runs as an isolated **child process** (`--run-miner` / `--run-drops`)
so a crash can't take down the app, and rdavydov's miner gets a real main thread
for its OS signal handlers. The frozen backend re-invokes *itself* for the
children, so no separate Python install is needed on the user's machine.

Config is a single JSON file at `%APPDATA%\TwitchFarmer\config.json`.

## Build from source

Prerequisites: **Python 3.12** (`py -V:3.12`), **Node 18+**, **Rust** (stable),
and the **WebView2 runtime** (preinstalled on Windows 11).

```powershell
# vendored sources already live under backend/vendor (points) and
# backend/vendor_drops (drops). One command does everything:
powershell -ExecutionPolicy Bypass -File build.ps1
```

The installer is written to
`src-tauri/target/release/bundle/nsis/Twitch Farmer_<version>_x64-setup.exe`.

### Dev loop

```powershell
# backend deps once
py -V:3.12 -m venv backend/.venv
backend/.venv/Scripts/python -m pip install -r backend/requirements.txt
# run the app with hot-reload (Rust spawns the venv backend automatically)
npm install
npm run tauri dev
```

## Project layout

| Path | What |
| --- | --- |
| `src/` | React + TypeScript + Tailwind UI |
| `src-tauri/` | Rust shell (tray, autostart, single-instance, backend supervision) |
| `backend/server.py` | aiohttp REST + WebSocket server |
| `backend/engines.py` | points / drops child-process managers |
| `backend/runner.py` | points-miner child entry (builds rdavydov miner from config) |
| `backend/drops_runner.py` + `drops_gui.py` | headless DevilXD adapter |
| `backend/vendor/` · `backend/vendor_drops/` | vendored upstream miners |

## Notes & limitations

- The optional **analytics** web-server needs `pandas`; it's excluded from the
  frozen bundle to keep it small. Install pandas into the backend venv if you
  enable analytics in a dev build.
- Username/password (passport) login for drops is intentionally disabled in the
  headless adapter — **device-code OAuth** is used for both miners.
- Respect Twitch's Terms of Service. This tool is provided as-is.

## License

GPLv3, inherited from both upstream projects.
