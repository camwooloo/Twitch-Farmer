import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import type { Config, EngineState, LogEntry, DeepPartial } from "./types";

interface BackendInfo {
  port: number;
  token: string;
}

interface Snapshot {
  state: Record<string, EngineState>;
  logs: LogEntry[];
}

export interface DropInfo {
  name: string;
  current: number;
  required: number;
  claimed: boolean;
  image?: string;
  category?: "badge" | "emote" | "reward";
}
export interface CampaignInfo {
  id: string;
  name: string;
  game: string | null;
  game_id?: string;
  image?: string;
  link_url?: string;
  ends_at?: string;
  claimed: number;
  total: number;
  active: boolean;
  finished: boolean;
  linked?: boolean;
  drops: DropInfo[];
}
export interface ClaimedDrop {
  name: string;
  game: string | null;
  image?: string;
}
export interface DropsLive {
  loginCode: { uri: string; code: string } | null;
  watching: { channel: string | null; game: string | null } | null;
  games: string[];
  campaigns: CampaignInfo[];
  recentClaimed: ClaimedDrop[];
  currentDrop:
    | { name: string; current: number; required: number; progress: number; game: string | null }
    | null;
}

interface AppState {
  connected: boolean;
  info: BackendInfo | null;
  points: EngineState;
  predictions: EngineState;
  drops: EngineState;
  logs: LogEntry[];
  config: Config | null;
  saving: boolean;
  dropsLive: DropsLive;
  streamerStatus: Record<string, { online: boolean; points: string }>;
  spadeBlocked: boolean;
  loginPrompt: { engine: string; uri: string; code: string } | null;
  dismissLogin: () => void;

  init: () => Promise<void>;
  api: (path: string, init?: RequestInit) => Promise<Response>;
  loadConfig: () => Promise<void>;
  saveConfig: (patch: DeepPartial<Config>) => Promise<void>;
  control: (engine: "points" | "predictions" | "drops" | "all", action: "start" | "stop") => Promise<void>;
  searchGames: (q: string) => Promise<{ id: string; name: string; image?: string }[]>;
  searchChannels: (q: string) => Promise<{ id: string; login: string; name: string; image?: string }[]>;
  fetchAnalytics: () => Promise<Record<string, { x: number; y: number }[]>>;
  fetchFollows: () => Promise<{ login: string; name: string; image?: string }[]>;
  fetchChannel: (login: string) => Promise<ChannelInfo>;

  // cached + throttled live data shared across views
  follows: { login: string; name: string; image?: string }[];
  followsLoaded: boolean;
  channelInfo: Record<string, ChannelInfo>;
  gameIcons: Record<string, string | null>;
  loadFollows: () => Promise<void>;
  loadChannelInfo: (login: string) => void;
  loadGameIcon: (name: string) => void;

  // updates
  currentVersion: string;
  releases: Release[];
  updateDismissed: boolean;
  loadReleases: () => Promise<void>;
  installUpdate: (url: string) => Promise<void>;
  dismissUpdate: () => void;
}

export interface Release {
  tag: string;
  name: string;
  notes: string;
  date: string;
  exe_url: string | null;
  html_url: string;
}

export interface ChannelInfo {
  login: string;
  balance: number | null;
  live: boolean;
  game: string | null;
  viewers: number;
  rewards: { title: string; cost: number; image?: string }[];
}

const MAX_LOGS = 1000;

export const useStore = create<AppState>((set, get) => ({
  connected: false,
  info: null,
  points: { running: false, status: "stopped" },
  predictions: { running: false, status: "stopped" },
  drops: { running: false, status: "stopped" },
  logs: [],
  config: null,
  saving: false,
  dropsLive: { loginCode: null, watching: null, games: [], campaigns: [], recentClaimed: [], currentDrop: null },
  streamerStatus: {},
  spadeBlocked: false,
  loginPrompt: null,
  dismissLogin: () => set({ loginPrompt: null }),
  follows: [],
  followsLoaded: false,
  channelInfo: {},
  gameIcons: {},
  currentVersion: "",
  releases: [],
  updateDismissed: false,

  init: async () => {
    let info: BackendInfo;
    try {
      info = await invoke<BackendInfo>("backend_info");
    } catch {
      // running the UI outside Tauri (plain vite) — fall back to dev defaults
      info = { port: 8917, token: "dev" };
    }
    set({ info });
    await waitForBackend(info);
    connectWs(info, set, get);
    await get().loadConfig();
    try {
      set({ currentVersion: await getVersion() });
    } catch {
      /* non-Tauri dev */
    }
    get().loadReleases();
  },

  api: async (path, init) => {
    const { info } = get();
    if (!info) throw new Error("no backend info");
    const headers = new Headers(init?.headers);
    headers.set("X-Token", info.token);
    if (init?.body) headers.set("Content-Type", "application/json");
    return fetch(`http://127.0.0.1:${info.port}${path}`, { ...init, headers });
  },

  loadConfig: async () => {
    const res = await get().api("/api/config");
    const config = (await res.json()) as Config;
    set({ config });
  },

  saveConfig: async (patch) => {
    const current = get().config;
    if (!current) return;
    const next = deepMerge(current, patch);
    set({ config: next, saving: true });
    scheduleFlush(get);
  },

  control: async (engine, action) => {
    await get().api("/api/control", {
      method: "POST",
      body: JSON.stringify({ engine, action }),
    });
  },

  searchGames: async (q) => {
    if (q.trim().length < 2) return [];
    try {
      const res = await get().api(`/api/twitch/games?q=${encodeURIComponent(q)}`);
      return (await res.json()).results ?? [];
    } catch {
      return [];
    }
  },

  searchChannels: async (q) => {
    if (q.trim().length < 2) return [];
    try {
      const res = await get().api(`/api/twitch/channels?q=${encodeURIComponent(q)}`);
      return (await res.json()).results ?? [];
    } catch {
      return [];
    }
  },

  fetchAnalytics: async () => {
    try {
      const res = await get().api("/api/analytics");
      return (await res.json()).streamers ?? {};
    } catch {
      return {};
    }
  },

  fetchFollows: async () => {
    try {
      const res = await get().api("/api/twitch/follows");
      return (await res.json()).results ?? [];
    } catch {
      return [];
    }
  },

  fetchChannel: async (login) => {
    const res = await get().api(`/api/twitch/channel?login=${encodeURIComponent(login)}`);
    return (await res.json()) as ChannelInfo;
  },

  loadFollows: async () => {
    if (get().followsLoaded) return;
    const follows = await get().fetchFollows();
    set({ follows, followsLoaded: true });
  },

  loadChannelInfo: (login) => {
    const key = login.toLowerCase();
    const existing = (get().channelInfo[key] as any)?._ts;
    if (channelInflight.has(key)) return;
    if (existing && Date.now() - existing < 60_000) return; // fresh enough
    channelInflight.add(key);
    channelLimiter(() => get().fetchChannel(key))
      .then((ci) => {
        (ci as any)._ts = Date.now();
        set({ channelInfo: { ...get().channelInfo, [key]: ci } });
      })
      .catch(() => {})
      .finally(() => channelInflight.delete(key));
  },

  loadGameIcon: (name) => {
    if (name in get().gameIcons || gameInflight.has(name)) return;
    gameInflight.add(name);
    gameLimiter(() => get().searchGames(name))
      .then((results) => {
        const match =
          results.find((r) => r.name.toLowerCase() === name.toLowerCase()) ?? results[0];
        set({ gameIcons: { ...get().gameIcons, [name]: match?.image ?? null } });
      })
      .catch(() => set({ gameIcons: { ...get().gameIcons, [name]: null } }))
      .finally(() => gameInflight.delete(name));
  },

  loadReleases: async () => {
    try {
      const res = await get().api("/api/updates");
      set({ releases: (await res.json()).releases ?? [] });
    } catch {
      /* offline */
    }
  },

  installUpdate: async (url) => {
    const res = await get().api("/api/update/download", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    const { path, error } = await res.json();
    if (error || !path) throw new Error(error || "download failed");
    await shellOpen(path); // launches the NSIS installer; it updates in place
  },

  dismissUpdate: () => set({ updateDismissed: true }),
}));

// "v1.2.3" -> [1,2,3]; higher tuple wins
function parseVer(v: string): number[] {
  return (v || "").replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
}
export function isNewer(a: string, b: string): boolean {
  const pa = parseVer(a), pb = parseVer(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0, y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

// shared concurrency limiters + in-flight de-dup for live lookups
function makeLimiter(limit: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    if (active >= limit || !queue.length) return;
    active++;
    queue.shift()!();
  };
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      queue.push(() => fn().then(resolve, reject).finally(() => { active--; next(); }));
      next();
    });
  };
}
const channelLimiter = makeLimiter(5);
const gameLimiter = makeLimiter(4);
const channelInflight = new Set<string>();
const gameInflight = new Set<string>();

let flushTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleFlush(get: () => AppState) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(async () => {
    const { config } = get();
    if (!config) return;
    try {
      await get().api("/api/config", { method: "PUT", body: JSON.stringify(config) });
    } finally {
      useStore.setState({ saving: false });
    }
  }, 400);
}

async function waitForBackend(info: BackendInfo) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${info.port}/api/health`);
      if (r.ok) return;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

function connectWs(
  info: BackendInfo,
  set: (partial: Partial<AppState>) => void,
  get: () => AppState,
) {
  const ws = new WebSocket(`ws://127.0.0.1:${info.port}/ws?token=${info.token}`);
  ws.onopen = () => set({ connected: true });
  ws.onclose = () => {
    set({ connected: false });
    setTimeout(() => connectWs(info, set, get), 1500);
  };
  ws.onmessage = (ev) => {
    const event = JSON.parse(ev.data);
    handleEvent(event, set, get);
  };
}

function handleEvent(
  event: { kind: string; payload: any; ts?: number },
  set: (partial: Partial<AppState>) => void,
  get: () => AppState,
) {
  switch (event.kind) {
    case "snapshot": {
      const snap = event.payload as Snapshot;
      set({
        points: snap.state.points ?? get().points,
        predictions: snap.state.predictions ?? get().predictions,
        drops: snap.state.drops ?? get().drops,
        logs: snap.logs.map((e: any) => ({ ...e.payload, ts: e.ts })),
      });
      break;
    }
    case "state": {
      const { engine, state } = event.payload;
      if (engine === "points") set({ points: state });
      if (engine === "predictions") set({ predictions: state });
      if (engine === "drops") set({ drops: state });
      break;
    }
    case "points_event": {
      const e = event.payload;
      if (e.username) {
        const cur = get().streamerStatus[e.username] ?? { online: false, points: "" };
        set({
          streamerStatus: {
            ...get().streamerStatus,
            [e.username]: {
              online: e.type === "status" ? !!e.online : cur.online,
              points: e.points ?? cur.points,
            },
          },
        });
      }
      break;
    }
    case "spade_blocked": {
      set({ spadeBlocked: true });
      break;
    }
    case "login": {
      const p = event.payload;
      set({ loginPrompt: { engine: p.engine, uri: p.uri || "https://www.twitch.tv/activate", code: p.code } });
      break;
    }
    case "login_ok": {
      const cur = get().loginPrompt;
      if (cur && cur.engine === event.payload.engine) set({ loginPrompt: null });
      break;
    }
    case "log": {
      const entry: LogEntry = { ...event.payload, ts: event.ts ?? Date.now() / 1000 };
      const logs = [...get().logs, entry].slice(-MAX_LOGS);
      set({ logs });
      break;
    }
    case "config": {
      set({ config: event.payload as Config });
      break;
    }
    case "drops_event": {
      handleDropsEvent(event.payload, set, get);
      break;
    }
  }
}

function handleDropsEvent(
  evt: any,
  set: (partial: Partial<AppState>) => void,
  get: () => AppState,
) {
  const live = { ...get().dropsLive };
  switch (evt.evt) {
    case "login_code":
      live.loginCode = { uri: evt.uri, code: evt.code };
      break;
    case "login_state":
      if (evt.user) live.loginCode = null; // logged in
      break;
    case "games":
      live.games = evt.games ?? [];
      break;
    case "watching":
      live.watching = { channel: evt.channel ?? null, game: evt.game ?? null };
      break;
    case "inv_clear":
      live.campaigns = [];
      break;
    case "campaign": {
      const c: CampaignInfo = {
        id: evt.id,
        name: evt.name,
        game: evt.game ?? null,
        game_id: evt.game_id,
        image: evt.image,
        link_url: evt.link_url,
        ends_at: evt.ends_at,
        claimed: evt.claimed ?? 0,
        total: evt.total ?? 0,
        active: !!evt.active,
        finished: !!evt.finished,
        linked: evt.linked,
        drops: evt.drops ?? [],
      };
      const idx = live.campaigns.findIndex((x) => x.id === c.id);
      live.campaigns = idx >= 0
        ? live.campaigns.map((x, i) => (i === idx ? c : x))
        : [...live.campaigns, c];
      // collect claimed drops for the "recently claimed" view
      const claimed = (c.drops || []).filter((d) => d.claimed);
      if (claimed.length) {
        const seen = new Set(live.recentClaimed.map((d) => d.name + d.game));
        const fresh = claimed
          .filter((d) => !seen.has(d.name + (c.game ?? "")))
          .map((d) => ({ name: d.name, game: c.game, image: d.image }));
        if (fresh.length) live.recentClaimed = [...fresh, ...live.recentClaimed].slice(0, 24);
      }
      break;
    }
    case "drop":
      live.currentDrop = {
        name: evt.name,
        current: evt.current,
        required: evt.required,
        progress: evt.progress,
        game: evt.game ?? null,
      };
      break;
    case "drop_clear":
      live.currentDrop = null;
      break;
  }
  set({ dropsLive: live });
}

// shallow-ish recursive merge so a partial patch keeps nested defaults
function deepMerge<T>(base: T, patch: any): T {
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...base };
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const pv = patch[key];
    const bv = (base as any)[key];
    if (
      pv &&
      typeof pv === "object" &&
      !Array.isArray(pv) &&
      bv &&
      typeof bv === "object"
    ) {
      out[key] = deepMerge(bv, pv as any);
    } else {
      out[key] = pv;
    }
  }
  return out;
}
