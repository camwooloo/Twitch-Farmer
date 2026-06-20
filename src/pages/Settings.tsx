import { useEffect, useState } from "react";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { useStore } from "../lib/store";
import { Section, Field, Toggle, Select, TextInput, Badge } from "../components/ui";
import { Account } from "./Account";
import { Notifications } from "./Notifications";
import { ReleaseNotes } from "../components/UpdateModal";

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
      {children}
    </div>
  );
}

const ACCENTS = [
  { value: "#9146FF", label: "Twitch Purple" },
  { value: "#2dd4a7", label: "Mint" },
  { value: "#ff5d6c", label: "Coral" },
  { value: "#ffb454", label: "Amber" },
  { value: "#4f8cff", label: "Azure" },
];

function Changelog() {
  const releases = useStore((s) => s.releases);
  const [openTag, setOpenTag] = useState<string | null>(null);
  if (releases.length === 0) {
    return (
      <Section title="Release history" description="Patch notes for every version.">
        <p className="py-2 text-center text-xs text-[var(--color-muted)]">
          No releases found (offline, or none published yet).
        </p>
      </Section>
    );
  }
  return (
    <Section title="Release history" description="Patch notes for every version.">
      <div className="space-y-2">
        {releases.map((r, i) => {
          const open = openTag === r.tag || (openTag === null && i === 0);
          return (
            <div key={r.tag} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]">
              <button
                onClick={() => setOpenTag(open ? "__none__" : r.tag)}
                className="flex w-full items-center justify-between gap-2 p-3 text-left"
              >
                <span className="flex items-center gap-2">
                  <Badge tone="accent">{r.tag}</Badge>
                  <span className="text-sm font-medium">{r.name}</span>
                </span>
                <span className="text-xs text-[var(--color-muted)]">
                  {r.date ? new Date(r.date).toLocaleDateString() : ""}
                </span>
              </button>
              {open && (
                <div className="border-t border-[var(--color-border)] p-3">
                  <ReleaseNotes notes={r.notes} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function Settings() {
  const config = useStore((s) => s.config)!;
  const save = useStore((s) => s.saveConfig);
  const currentVersion = useStore((s) => s.currentVersion);
  const app = config.app;
  const [autostartReady, setAutostartReady] = useState(false);

  // keep the OS autostart registration in sync with config on mount
  useEffect(() => {
    isEnabled()
      .then((on) => {
        if (on !== app.run_on_startup) {
          save({ app: { run_on_startup: on } });
        }
      })
      .catch(() => {})
      .finally(() => setAutostartReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setRunOnStartup(v: boolean) {
    save({ app: { run_on_startup: v } });
    try {
      if (v) await enable();
      else await disable();
    } catch {
      /* ignore — non-Tauri dev */
    }
  }

  async function setAccent(hex: string) {
    save({ app: { accent: hex } });
    document.documentElement.style.setProperty("--color-accent", hex);
  }

  return (
    <div className="space-y-6">
      <GroupLabel>Account</GroupLabel>
      <Account />

      <GroupLabel>Application</GroupLabel>
      <Section
        title="Startup & tray"
        description="Control how Twitch Farmer launches and lives in the background."
      >
        <Toggle
          label="Run on Windows startup"
          description={autostartReady ? "Launch automatically when you sign in" : "Checking…"}
          checked={app.run_on_startup}
          onChange={setRunOnStartup}
        />
        <Toggle
          label="Start in tray"
          description="Launch hidden to the system tray (no window on start)"
          checked={app.start_in_tray}
          onChange={(v) => save({ app: { start_in_tray: v } })}
        />
        <Toggle
          label="Close to tray"
          description="Closing the window keeps mining in the background"
          checked={app.close_to_tray}
          onChange={(v) => save({ app: { close_to_tray: v } })}
        />
        <Toggle
          label="Minimize to tray"
          description="Minimizing hides the window to the tray"
          checked={app.minimize_to_tray}
          onChange={(v) => save({ app: { minimize_to_tray: v } })}
        />
        <Toggle
          label="Auto-start mining on launch"
          description="Begin the enabled miners as soon as the app opens"
          checked={app.autostart_mining}
          onChange={(v) => save({ app: { autostart_mining: v } })}
        />
      </Section>

      <Section title="Appearance">
        <Field label="Accent colour">
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                onClick={() => setAccent(a.value)}
                className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition"
                style={{
                  borderColor: app.accent === a.value ? a.value : "var(--color-border)",
                }}
              >
                <span className="h-3 w-3 rounded-full" style={{ background: a.value }} />
                {a.label}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      <GroupLabel>Notifications</GroupLabel>
      <Notifications />

      <GroupLabel>Logging</GroupLabel>
      <Section
        title="Logging"
        description="How the points miner writes its logs."
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Console level">
            <Select
              value={config.logger.console_level}
              options={["DEBUG", "INFO", "WARNING", "ERROR"].map((l) => ({ value: l, label: l }))}
              onChange={(e) => save({ logger: { console_level: e.target.value } })}
            />
          </Field>
          <Field label="File level">
            <Select
              value={config.logger.file_level}
              options={["DEBUG", "INFO", "WARNING", "ERROR"].map((l) => ({ value: l, label: l }))}
              onChange={(e) => save({ logger: { file_level: e.target.value } })}
            />
          </Field>
        </div>
        <Toggle label="Save logs to file" checked={config.logger.save} onChange={(v) => save({ logger: { save: v } })} />
        <Toggle label="Less verbose" checked={config.logger.less} onChange={(v) => save({ logger: { less: v } })} />
        <Toggle label="Show emoji in logs" checked={config.logger.emoji} onChange={(v) => save({ logger: { emoji: v } })} />
        <Field label="Time zone" hint="tz database name, e.g. America/Denver">
          <TextInput
            value={config.logger.time_zone}
            placeholder="system default"
            onChange={(e) => save({ logger: { time_zone: e.target.value } })}
          />
        </Field>
      </Section>

      <Section title="Advanced">
        <Toggle
          label="Track points over time"
          description="Records your point balance so the built-in Analytics chart can show history"
          checked={config.enable_analytics}
          onChange={(v) => save({ enable_analytics: v })}
        />
        <Toggle
          label="Disable SSL certificate verification"
          description="Only enable to work around CERTIFICATE_VERIFY_FAILED — reduces security"
          checked={config.disable_ssl_cert_verification}
          onChange={(v) => save({ disable_ssl_cert_verification: v })}
        />
      </Section>

      <GroupLabel>What's new</GroupLabel>
      <Changelog />

      <div className="flex items-center gap-2 pb-4 text-xs text-[var(--color-muted)]">
        <Badge tone="neutral">v{currentVersion || "0.1.0"}</Badge>
        Config stored in %APPDATA%\TwitchFarmer\config.json
      </div>
    </div>
  );
}
