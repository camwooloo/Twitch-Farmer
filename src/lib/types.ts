// Mirrors backend/config.py — keep in sync.

export interface FilterCondition {
  by: string;
  where: string;
  value: number;
}
export interface BetSettings {
  strategy: string;
  percentage: number;
  percentage_gap: number;
  max_points: number;
  stealth_mode: boolean;
  delay_mode: string;
  delay: number;
  minimum_points: number;
  filter_condition: FilterCondition;
}
export interface StreamerSettings {
  make_predictions: boolean;
  follow_raid: boolean;
  claim_drops: boolean;
  claim_moments: boolean;
  watch_streak: boolean;
  community_goals: boolean;
  chat: string;
  bet: BetSettings;
}
export interface Streamer {
  username: string;
  display_name: string;
  avatar: string;
  override: boolean;
  settings: StreamerSettings;
}
export interface ColorPalette {
  STREAMER_online: string;
  streamer_offline: string;
  BET_win: string;
}
export interface LoggerSettings {
  save: boolean;
  console_level: string;
  console_username: boolean;
  auto_clear: boolean;
  time_zone: string;
  file_level: string;
  emoji: boolean;
  less: boolean;
  colored: boolean;
  color_palette: ColorPalette;
}
export interface NotifyBase {
  enabled: boolean;
  events: string[];
}
export interface Telegram extends NotifyBase {
  chat_id: number;
  token: string;
  disable_notification: boolean;
}
export interface Discord extends NotifyBase {
  webhook_api: string;
}
export interface Webhook extends NotifyBase {
  endpoint: string;
  method: string;
}
export interface Matrix extends NotifyBase {
  username: string;
  password: string;
  homeserver: string;
  room_id: string;
}
export interface Pushover extends NotifyBase {
  userkey: string;
  token: string;
  priority: number;
  sound: string;
}
export interface Gotify extends NotifyBase {
  endpoint: string;
  priority: number;
}
export interface DropsSettings {
  enabled: boolean;
  priority_games: string[];
  mine_all: boolean;
  exclude: string[];
  priority_mode: string;
  farm_badges: boolean;
  proxy: string;
}
export interface AppSettings {
  run_on_startup: boolean;
  start_in_tray: boolean;
  minimize_to_tray: boolean;
  close_to_tray: boolean;
  theme: string;
  accent: string;
  autostart_mining: boolean;
}
export interface Config {
  username: string;
  password: string;
  claim_drops_startup: boolean;
  enable_analytics: boolean;
  disable_ssl_cert_verification: boolean;
  disable_at_in_nickname: boolean;
  priority: string[];
  logger: LoggerSettings;
  telegram: Telegram;
  discord: Discord;
  webhook: Webhook;
  matrix: Matrix;
  pushover: Pushover;
  gotify: Gotify;
  streamer_settings: StreamerSettings;
  streamers: Streamer[];
  followers: boolean;
  followers_order: string;
  drops: DropsSettings;
  app: AppSettings;
  points_enabled: boolean;
  predictions_enabled: boolean;
}

export interface StreamerStatus {
  online: boolean;
  points: string;
}

export type DeepPartial<T> = T extends (infer U)[]
  ? U[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export interface EngineState {
  running: boolean;
  status: string;
}
export interface LogEntry {
  level: string;
  message: string;
  source: string;
  ts: number;
}
