import { useStore } from "../lib/store";
import { Section, Field, TextInput, Toggle } from "../components/ui";

const PRIORITIES = ["STREAK", "DROPS", "ORDER", "POINTS_ASCENDING", "POINTS_DESCENDING"];

export function Account() {
  const config = useStore((s) => s.config)!;
  const save = useStore((s) => s.saveConfig);

  return (
    <div className="space-y-6">
      <Section
        title="Twitch account"
        description="Your login is used by the points miner. Leave the password blank to be prompted on first start."
      >
        <Field label="Username">
          <TextInput
            value={config.username}
            placeholder="your-twitch-username"
            onChange={(e) => save({ username: e.target.value })}
          />
        </Field>
        <Field label="Password" hint="stored locally in your config">
          <TextInput
            type="password"
            value={config.password}
            placeholder="••••••••"
            onChange={(e) => save({ password: e.target.value })}
          />
        </Field>
      </Section>

      <Section
        title="Priority"
        description="Order in which the miner allocates watch-time across goals."
      >
        <div className="flex flex-wrap gap-2">
          {config.priority.map((p, i) => (
            <span
              key={p}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs"
            >
              <span className="text-[var(--color-muted)]">{i + 1}</span>
              {p}
              <button
                className="text-[var(--color-bad)] hover:opacity-70"
                onClick={() => save({ priority: config.priority.filter((x) => x !== p) })}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {PRIORITIES.filter((p) => !config.priority.includes(p)).map((p) => (
            <button
              key={p}
              onClick={() => save({ priority: [...config.priority, p] })}
              className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
            >
              + {p}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Behaviour">
        <Toggle
          label="Claim drops on startup"
          description="Auto-claim all pending drops from your Twitch inventory when mining starts"
          checked={config.claim_drops_startup}
          onChange={(v) => save({ claim_drops_startup: v })}
        />
        <Toggle
          label="Mine your followed channels"
          description="Automatically include every streamer you follow"
          checked={config.followers}
          onChange={(v) => save({ followers: v })}
        />
        <Toggle
          label="Detect mentions without @"
          description="Check chat for your nickname even when not prefixed with @"
          checked={config.disable_at_in_nickname}
          onChange={(v) => save({ disable_at_in_nickname: v })}
        />
      </Section>

    </div>
  );
}
