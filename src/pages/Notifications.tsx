import { useStore } from "../lib/store";
import { Section, Field, TextInput, Toggle, Select } from "../components/ui";
import clsx from "clsx";

const EVENTS = [
  "STREAMER_ONLINE", "STREAMER_OFFLINE", "GAIN_FOR_RAID", "GAIN_FOR_CLAIM",
  "GAIN_FOR_WATCH", "GAIN_FOR_WATCH_STREAK", "BET_WIN", "BET_LOSE",
  "BET_REFUND", "BET_FILTERS", "BET_GENERAL", "BET_FAILED", "BET_START",
  "BONUS_CLAIM", "MOMENT_CLAIM", "JOIN_RAID", "DROP_CLAIM", "DROP_STATUS",
  "CHAT_MENTION",
];

function EventsPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (ev: string) =>
    onChange(selected.includes(ev) ? selected.filter((e) => e !== ev) : [...selected, ev]);
  return (
    <Field label="Events" hint={`${selected.length} selected`}>
      <div className="flex flex-wrap gap-1.5">
        {EVENTS.map((ev) => {
          const on = selected.includes(ev);
          return (
            <button
              key={ev}
              type="button"
              onClick={() => toggle(ev)}
              className={clsx(
                "rounded-md px-2 py-1 text-[10px] font-medium transition",
                on
                  ? "bg-[var(--color-accent)]/20 text-[var(--color-accent-soft)]"
                  : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]",
              )}
            >
              {ev}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function Notifications() {
  const config = useStore((s) => s.config)!;
  const save = useStore((s) => s.saveConfig);

  return (
    <div className="space-y-6">
      <p className="text-xs text-[var(--color-muted)]">
        Get push updates for the events you care about. Enable a provider, fill in its
        credentials, then pick which events to forward.
      </p>

      {/* Telegram */}
      <Section
        title="Telegram"
        right={
          <Toggle
            checked={config.telegram.enabled}
            onChange={(v) => save({ telegram: { enabled: v } })}
          />
        }
      >
        {config.telegram.enabled && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Chat ID" hint="@getmyid_bot">
                <TextInput
                  type="number"
                  value={config.telegram.chat_id}
                  onChange={(e) => save({ telegram: { chat_id: Number(e.target.value) } })}
                />
              </Field>
              <Field label="Bot token" hint="@BotFather">
                <TextInput
                  value={config.telegram.token}
                  onChange={(e) => save({ telegram: { token: e.target.value } })}
                />
              </Field>
            </div>
            <Toggle
              label="Silent notifications"
              checked={config.telegram.disable_notification}
              onChange={(v) => save({ telegram: { disable_notification: v } })}
            />
            <EventsPicker
              selected={config.telegram.events}
              onChange={(v) => save({ telegram: { events: v } })}
            />
          </>
        )}
      </Section>

      {/* Discord */}
      <Section
        title="Discord"
        right={<Toggle checked={config.discord.enabled} onChange={(v) => save({ discord: { enabled: v } })} />}
      >
        {config.discord.enabled && (
          <>
            <Field label="Webhook URL">
              <TextInput
                value={config.discord.webhook_api}
                placeholder="https://discord.com/api/webhooks/…"
                onChange={(e) => save({ discord: { webhook_api: e.target.value } })}
              />
            </Field>
            <EventsPicker selected={config.discord.events} onChange={(v) => save({ discord: { events: v } })} />
          </>
        )}
      </Section>

      {/* Webhook */}
      <Section
        title="Generic webhook"
        right={<Toggle checked={config.webhook.enabled} onChange={(v) => save({ webhook: { enabled: v } })} />}
      >
        {config.webhook.enabled && (
          <>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Field label="Endpoint">
                <TextInput
                  value={config.webhook.endpoint}
                  placeholder="https://example.com/webhook"
                  onChange={(e) => save({ webhook: { endpoint: e.target.value } })}
                />
              </Field>
              <Field label="Method">
                <Select
                  value={config.webhook.method}
                  options={[{ value: "GET", label: "GET" }, { value: "POST", label: "POST" }]}
                  onChange={(e) => save({ webhook: { method: e.target.value } })}
                />
              </Field>
            </div>
            <EventsPicker selected={config.webhook.events} onChange={(v) => save({ webhook: { events: v } })} />
          </>
        )}
      </Section>

      {/* Matrix */}
      <Section
        title="Matrix"
        right={<Toggle checked={config.matrix.enabled} onChange={(v) => save({ matrix: { enabled: v } })} />}
      >
        {config.matrix.enabled && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Username"><TextInput value={config.matrix.username} onChange={(e) => save({ matrix: { username: e.target.value } })} /></Field>
              <Field label="Password"><TextInput type="password" value={config.matrix.password} onChange={(e) => save({ matrix: { password: e.target.value } })} /></Field>
              <Field label="Homeserver"><TextInput value={config.matrix.homeserver} onChange={(e) => save({ matrix: { homeserver: e.target.value } })} /></Field>
              <Field label="Room ID"><TextInput value={config.matrix.room_id} onChange={(e) => save({ matrix: { room_id: e.target.value } })} /></Field>
            </div>
            <EventsPicker selected={config.matrix.events} onChange={(v) => save({ matrix: { events: v } })} />
          </>
        )}
      </Section>

      {/* Pushover */}
      <Section
        title="Pushover"
        right={<Toggle checked={config.pushover.enabled} onChange={(v) => save({ pushover: { enabled: v } })} />}
      >
        {config.pushover.enabled && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="User key"><TextInput value={config.pushover.userkey} onChange={(e) => save({ pushover: { userkey: e.target.value } })} /></Field>
              <Field label="App token"><TextInput value={config.pushover.token} onChange={(e) => save({ pushover: { token: e.target.value } })} /></Field>
              <Field label="Priority"><TextInput type="number" value={config.pushover.priority} onChange={(e) => save({ pushover: { priority: Number(e.target.value) } })} /></Field>
              <Field label="Sound"><TextInput value={config.pushover.sound} onChange={(e) => save({ pushover: { sound: e.target.value } })} /></Field>
            </div>
            <EventsPicker selected={config.pushover.events} onChange={(v) => save({ pushover: { events: v } })} />
          </>
        )}
      </Section>

      {/* Gotify */}
      <Section
        title="Gotify"
        right={<Toggle checked={config.gotify.enabled} onChange={(v) => save({ gotify: { enabled: v } })} />}
      >
        {config.gotify.enabled && (
          <>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Field label="Endpoint"><TextInput value={config.gotify.endpoint} placeholder="https://example.com/message?token=TOKEN" onChange={(e) => save({ gotify: { endpoint: e.target.value } })} /></Field>
              <Field label="Priority"><TextInput type="number" value={config.gotify.priority} onChange={(e) => save({ gotify: { priority: Number(e.target.value) } })} /></Field>
            </div>
            <EventsPicker selected={config.gotify.events} onChange={(v) => save({ gotify: { events: v } })} />
          </>
        )}
      </Section>
    </div>
  );
}
