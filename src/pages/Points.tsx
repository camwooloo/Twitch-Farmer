import { Trash2, Coins, Play, Square, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { useStore } from "../lib/store";
import { Section, Field, Select, Toggle, Card, Button } from "../components/ui";
import { Autocomplete } from "../components/Autocomplete";
import { SpadeBanner } from "../components/SpadeBanner";
import { FollowsBrowser } from "../components/FollowsBrowser";
import { ChannelRow } from "../components/ChannelRow";
import { move, reorder } from "../lib/move";
import { useSortable } from "../lib/useSortable";
import type { Streamer } from "../lib/types";

const CHAT = ["ALWAYS", "NEVER", "ONLINE", "OFFLINE"];

function StreamerList({ streamers }: { streamers: Streamer[] }) {
  const save = useStore((s) => s.saveConfig);
  const { over, itemProps } = useSortable((from, to) =>
    save({ streamers: reorder(streamers, from, to) }),
  );
  const remove = (username: string) =>
    save({ streamers: streamers.filter((x) => x.username !== username) });

  return (
    <div className="space-y-2">
      {streamers.map((s, i) => (
        <div
          key={s.username}
          {...itemProps(i)}
          className={
            "cursor-grab rounded-xl transition active:cursor-grabbing " +
            (over === i ? "ring-2 ring-[var(--color-accent)]/50" : "")
          }
        >
          <ChannelRow
            login={s.username}
            name={s.display_name || s.username}
            image={s.avatar}
            leading={
              <div className="flex items-center">
                <GripVertical size={15} className="shrink-0 text-[var(--color-border)]" />
                <div className="flex flex-col">
                  <button
                    disabled={i === 0}
                    onClick={() => save({ streamers: move(streamers, i, -1) })}
                    className="text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-20"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    disabled={i === streamers.length - 1}
                    onClick={() => save({ streamers: move(streamers, i, 1) })}
                    className="text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-20"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            }
            trailing={
              <button
                onClick={() => remove(s.username)}
                title="Remove"
                className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-bad)]"
              >
                <Trash2 size={15} />
              </button>
            }
          />
        </div>
      ))}
    </div>
  );
}

export function Points() {
  const config = useStore((s) => s.config)!;
  const save = useStore((s) => s.saveConfig);
  const searchChannels = useStore((s) => s.searchChannels);
  const points = useStore((s) => s.points);
  const control = useStore((s) => s.control);
  const ss = config.streamer_settings;

  function addStreamer(c: { login: string; name: string; image?: string }) {
    const name = c.login.trim().toLowerCase();
    if (!name || config.streamers.some((s) => s.username === name)) return;
    const streamer: Streamer = {
      username: name,
      display_name: c.name,
      avatar: c.image ?? "",
      override: false,
      settings: ss,
    };
    save({ streamers: [...config.streamers, streamer] });
  }

  const addedSet = new Set(config.streamers.map((s) => s.username));

  return (
    <div className="space-y-6">
      <SpadeBanner />

      <Card className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent-soft)]">
            <Coins size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold">Points miner</div>
            <div className="text-xs text-[var(--color-muted)]">
              Watch streaks · raids · moments · channel points
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Toggle
            checked={config.points_enabled}
            onChange={(v) => save({ points_enabled: v })}
          />
          <Button
            variant={points.running ? "danger" : "primary"}
            onClick={() => control("points", points.running ? "stop" : "start")}
          >
            {points.running ? <Square size={14} /> : <Play size={14} />}
            {points.running ? "Stop" : "Start"}
          </Button>
        </div>
      </Card>

      <Section
        title="Channels being farmed"
        description="In priority order — Twitch only counts ~2 watched channels at once, so put your favourites on top. Reorder with the arrows."
      >
        <Autocomplete
          placeholder="Search Twitch channels…"
          icon={<Coins size={15} />}
          rounded
          search={searchChannels}
          getLabel={(c) => c.name}
          getSublabel={(c) => `@${c.login}`}
          getImage={(c) => c.image}
          onSelect={addStreamer}
        />
        {config.streamers.length > 0 ? (
          <StreamerList streamers={config.streamers} />
        ) : (
          <p className="py-4 text-center text-xs text-[var(--color-muted)]">
            No channels yet. Search above, or enable “Mine followed channels” in Settings.
          </p>
        )}
      </Section>

      <Section
        title="Channels you follow"
        description="Live status, point balances and rewards — add any to your farm."
      >
        <FollowsBrowser added={addedSet} onAdd={addStreamer} />
      </Section>

      <Section title="Watch options" description="What the points miner does on each channel.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Toggle label="Follow raids" checked={ss.follow_raid} onChange={(v) => save({ streamer_settings: { follow_raid: v } })} />
          <Toggle label="Claim drops while watching" checked={ss.claim_drops} onChange={(v) => save({ streamer_settings: { claim_drops: v } })} />
          <Toggle label="Claim moments" checked={ss.claim_moments} onChange={(v) => save({ streamer_settings: { claim_moments: v } })} />
          <Toggle label="Watch streak" checked={ss.watch_streak} onChange={(v) => save({ streamer_settings: { watch_streak: v } })} />
          <Toggle label="Community goals" checked={ss.community_goals} onChange={(v) => save({ streamer_settings: { community_goals: v } })} />
        </div>
        <Field label="Chat presence" hint="join IRC chat to boost watch-time">
          <Select
            value={ss.chat}
            options={CHAT.map((c) => ({ value: c, label: c }))}
            onChange={(e) => save({ streamer_settings: { chat: e.target.value } })}
          />
        </Field>
      </Section>
    </div>
  );
}
