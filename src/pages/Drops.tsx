import { useEffect, useState } from "react";
import {
  Plus, Trash2, Gift, Tv, CheckCircle2, ChevronUp, ChevronDown, Clock, Link2,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { useStore } from "../lib/store";
import { Section, Field, TextInput, Select, Toggle, Badge, Card } from "../components/ui";
import { Autocomplete } from "../components/Autocomplete";
import { move, reorder } from "../lib/move";
import { useSortable } from "../lib/useSortable";

const PRIORITY_MODES = [
  { value: "ENDING_SOONEST", label: "Campaigns ending soonest" },
  { value: "LOW_AVBL_FIRST", label: "Low availability first" },
];

function ListEditor({
  items,
  onChange,
  placeholder,
  ordered,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  ordered?: boolean;
}) {
  const searchGames = useStore((s) => s.searchGames);
  const loadGameIcon = useStore((s) => s.loadGameIcon);
  const gameIcons = useStore((s) => s.gameIcons);
  const { over, itemProps } = useSortable((from, to) => onChange(reorder(items, from, to)));
  useEffect(() => {
    items.forEach((g) => loadGameIcon(g));
  }, [items, loadGameIcon]);
  const add = (name: string) => {
    const v = name.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
  };
  return (
    <div className="space-y-2">
      <Autocomplete
        placeholder={placeholder}
        icon={<Gift size={15} />}
        search={searchGames}
        getLabel={(g) => g.name}
        getImage={(g) => g.image}
        onSelect={(g) => add(g.name)}
      />
      <div className="space-y-1.5">
        {items.map((g, i) => (
          <div
            key={g}
            {...(ordered ? itemProps(i) : {})}
            className={
              "flex items-center justify-between rounded-lg border bg-[var(--color-surface-2)] px-3 py-2 text-sm transition " +
              (ordered ? "cursor-grab active:cursor-grabbing " : "") +
              (over === i ? "border-[var(--color-accent)]/60" : "border-[var(--color-border)]")
            }
          >
            <span className="flex items-center gap-2.5">
              {ordered && (
                <span className="w-5 text-center text-xs text-[var(--color-muted)]">{i + 1}</span>
              )}
              {gameIcons[g] ? (
                <img src={gameIcons[g]!} alt="" className="h-8 w-6 rounded object-cover" />
              ) : (
                <span className="grid h-8 w-6 place-items-center rounded bg-[var(--color-surface)] text-[var(--color-good)]">
                  <Gift size={13} />
                </span>
              )}
              {g}
            </span>
            <span className="flex items-center gap-1">
              {ordered && (
                <>
                  <button
                    disabled={i === 0}
                    onClick={() => onChange(move(items, i, -1))}
                    className="text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-25"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    disabled={i === items.length - 1}
                    onClick={() => onChange(move(items, i, 1))}
                    className="text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-25"
                  >
                    <ChevronDown size={15} />
                  </button>
                </>
              )}
              <button
                className="ml-1 text-[var(--color-muted)] hover:text-[var(--color-bad)]"
                onClick={() => onChange(items.filter((x) => x !== g))}
              >
                <Trash2 size={15} />
              </button>
            </span>
          </div>
        ))}
        {items.length === 0 && (
          <p className="py-2 text-center text-xs text-[var(--color-muted)]">Nothing here yet.</p>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg)]">
      <div
        className="h-full rounded-full bg-[var(--color-accent)] transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}

function sortCampaigns<T extends { active: boolean; finished: boolean; claimed: number; total: number }>(
  list: T[],
): T[] {
  return [...list].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (a.finished !== b.finished) return a.finished ? 1 : -1;
    const ra = a.total ? a.claimed / a.total : 0;
    const rb = b.total ? b.claimed / b.total : 0;
    return rb - ra;
  });
}

function endsIn(iso?: string): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (isNaN(ms) || ms <= 0) return null;
  const d = Math.floor(ms / 86400e3);
  if (d >= 1) return `${d}d left`;
  const h = Math.floor(ms / 3600e3);
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.floor(ms / 60e3))}m left`;
}

function CampaignCard({
  c,
  inPriority,
  onAdd,
}: {
  c: import("../lib/store").CampaignInfo;
  inPriority: boolean;
  onAdd: () => void;
}) {
  const ends = endsIn(c.ends_at);
  const done = c.finished || (c.total > 0 && c.claimed >= c.total);
  const needsLink = c.linked === false && !done;
  const farmable = c.active && c.linked !== false && !done;
  return (
    <div
      className={
        "rounded-xl border bg-[var(--color-surface-2)] p-3 " +
        (needsLink ? "border-[var(--color-warn)]/40" : "border-[var(--color-border)]")
      }
    >
      <div className="flex items-start gap-3">
        {c.image ? (
          <img src={c.image} alt="" className="h-16 w-12 shrink-0 rounded-md object-cover" />
        ) : (
          <div className="grid h-16 w-12 shrink-0 place-items-center rounded-md bg-[var(--color-surface)] text-[var(--color-muted)]">
            <Gift size={18} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{c.game ?? c.name}</div>
              <div className="truncate text-xs text-[var(--color-muted)]">{c.name}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {done ? (
                <Badge tone="good">complete</Badge>
              ) : needsLink ? (
                <Badge tone="warn">link needed</Badge>
              ) : farmable ? (
                <Badge tone="good">farmable</Badge>
              ) : !c.active ? (
                <Badge tone="neutral">ended</Badge>
              ) : null}
              <Badge tone="neutral">{c.claimed}/{c.total}</Badge>
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[var(--color-muted)]">
            {ends && (
              <span className="flex items-center gap-1">
                <Clock size={11} /> {ends}
              </span>
            )}
            {needsLink && c.link_url && (
              <button
                onClick={() => open(c.link_url!).catch(() => {})}
                className="flex items-center gap-1 rounded-md bg-[var(--color-warn)]/15 px-2 py-0.5 font-medium text-[var(--color-warn)] hover:bg-[var(--color-warn)]/25"
              >
                <Link2 size={11} /> Link account to farm
              </button>
            )}
            <button
              disabled={inPriority || !c.game}
              onClick={onAdd}
              className={
                "ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 transition " +
                (inPriority
                  ? "text-[var(--color-good)]"
                  : "bg-[var(--color-accent)]/15 text-[var(--color-accent-soft)] hover:bg-[var(--color-accent)]/25")
              }
            >
              {inPriority ? <CheckCircle2 size={12} /> : <Plus size={12} />}
              {inPriority ? "farming" : "add to farm"}
            </button>
          </div>
        </div>
      </div>
      {c.drops.length > 0 && (
        <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {c.drops.map((d, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-[var(--color-bg-soft)] p-1.5">
              {d.image ? (
                <img src={d.image} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
              ) : (
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-[var(--color-surface)] text-[var(--color-muted)]">
                  <Gift size={12} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center justify-between gap-1 text-[10px]">
                  <span className={"truncate " + (d.claimed ? "text-[var(--color-good)]" : "text-[var(--color-muted)]")}>
                    {d.claimed ? "✓ " : ""}{d.name}
                  </span>
                  <span className="shrink-0 text-[var(--color-muted)]">
                    {Math.min(d.current, d.required)}/{d.required}m
                  </span>
                </div>
                <ProgressBar value={d.required ? d.current / d.required : d.claimed ? 1 : 0} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const CAMPAIGN_FILTERS = [
  { key: "all", label: "All" },
  { key: "farmable", label: "Farmable now" },
  { key: "link", label: "Need linking" },
  { key: "badges", label: "Badges & emotes" },
];

function LiveDrops() {
  const live = useStore((s) => s.dropsLive);
  const drops = useStore((s) => s.drops);
  const config = useStore((s) => s.config)!;
  const save = useStore((s) => s.saveConfig);
  const [filter, setFilter] = useState("all");
  if (!drops.running && !live.loginCode && live.campaigns.length === 0) return null;

  const priority = config.drops.priority_games;
  const addToPriority = (game: string | null) => {
    if (!game || priority.includes(game)) return;
    save({ drops: { priority_games: [...priority, game] } });
  };

  const isDone = (c: (typeof live.campaigns)[number]) =>
    c.finished || (c.total > 0 && c.claimed >= c.total);
  const farmableCount = live.campaigns.filter((c) => c.active && c.linked !== false && !isDone(c)).length;
  const linkCount = live.campaigns.filter((c) => c.linked === false && !isDone(c)).length;

  const filtered = live.campaigns.filter((c) => {
    if (filter === "farmable") return c.active && c.linked !== false && !isDone(c);
    if (filter === "link") return c.linked === false && !isDone(c);
    if (filter === "badges") return c.drops.some((d) => d.category === "badge" || d.category === "emote");
    return true;
  });

  return (
    <div className="space-y-6">
      {(live.watching?.channel || live.currentDrop) && (
        <Section title="Now mining">
          {live.watching?.channel && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex items-center gap-1.5">
                <Tv size={15} className="text-[var(--color-good)]" />
                Watching <b>{live.watching.channel}</b>
              </span>
              {live.watching.game && (
                <Badge tone="neutral">{live.watching.game}</Badge>
              )}
              {live.currentDrop && (
                <span className="text-[var(--color-muted)]">
                  for <b className="text-[var(--color-text)]">{live.currentDrop.name}</b>
                </span>
              )}
              <button
                onClick={() => open(`https://twitch.tv/${live.watching!.channel}`).catch(() => {})}
                className="ml-auto flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                <Tv size={12} /> open stream
              </button>
            </div>
          )}
          {live.currentDrop && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium">{live.currentDrop.name}</span>
                <span className="text-[var(--color-muted)]">
                  {live.currentDrop.current}/{live.currentDrop.required} min
                </span>
              </div>
              <ProgressBar value={live.currentDrop.progress} />
            </div>
          )}
        </Section>
      )}

      {live.campaigns.length > 0 && (
        <Section
          title="Live drop campaigns"
          description="Campaigns in your inventory. Only active, account-linked ones are auto-farmed."
          right={
            <span className="flex items-center gap-1.5 text-xs">
              <Badge tone="good">{farmableCount} farmable</Badge>
              {linkCount > 0 && <Badge tone="warn">{linkCount} need link</Badge>}
            </span>
          }
        >
          {linkCount > 0 && filter !== "link" && (
            <div className="rounded-lg border border-[var(--color-warn)]/30 bg-[var(--color-warn)]/10 p-2.5 text-xs text-[var(--color-muted)]">
              <b className="text-[var(--color-text)]">{linkCount} active campaign(s) need account linking.</b>{" "}
              Twitch only awards drops for games you've linked your account to — click “Link account
              to farm” on a campaign, link it on Twitch, then it'll be farmed automatically.
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {CAMPAIGN_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={
                  "rounded-lg px-2.5 py-1 text-xs transition " +
                  (filter === f.key
                    ? "bg-[var(--color-accent)]/20 text-[var(--color-accent-soft)]"
                    : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]")
                }
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {sortCampaigns(filtered).map((c) => (
              <CampaignCard
                key={c.id}
                c={c}
                inPriority={!!c.game && priority.includes(c.game)}
                onAdd={() => addToPriority(c.game)}
              />
            ))}
            {filtered.length === 0 && (
              <p className="py-4 text-center text-xs text-[var(--color-muted)]">
                No campaigns match this filter.
              </p>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

export function Drops() {
  const config = useStore((s) => s.config)!;
  const save = useStore((s) => s.saveConfig);
  const drops = config.drops;

  return (
    <div className="space-y-6">
      <LiveDrops />
      <Section
        title="Drops engine"
        description="Farm Twitch drop campaigns — game rewards, badges and emotes — DevilXD style."
        right={<Toggle checked={drops.enabled} onChange={(v) => save({ drops: { enabled: v } })} />}
      >
        <Toggle
          label="Mine all available campaigns"
          description="Farm every campaign you're eligible for, your priority games first. Turn OFF to farm only your priority list."
          checked={drops.mine_all}
          onChange={(v) => save({ drops: { mine_all: v } })}
        />
        <Toggle
          label="Always farm badges & emotes (top priority)"
          description="Always include badge and emote drop campaigns, even when farming a specific game list."
          checked={drops.farm_badges}
          onChange={(v) => save({ drops: { farm_badges: v } })}
        />
        {drops.mine_all ? (
          <Field label="Order other games by" hint="after your priority games">
            <Select
              value={drops.priority_mode}
              options={PRIORITY_MODES}
              onChange={(e) => save({ drops: { priority_mode: e.target.value } })}
            />
          </Field>
        ) : (
          <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-2.5 text-xs text-[var(--color-muted)]">
            Only your priority games below will be farmed. Many campaigns (Riot, Ubisoft, EA…) also
            require <b className="text-[var(--color-text)]">linking your Twitch account</b> to the game
            on the campaign's page before drops can be earned.
          </p>
        )}
      </Section>

      <Section
        title="Priority games"
        description="Games to farm first, in order. With “mine all” off, only these are farmed."
        right={<Badge tone="accent">{drops.priority_games.length}</Badge>}
      >
        <ListEditor
          ordered
          items={drops.priority_games}
          placeholder="e.g. Rust"
          onChange={(v) => save({ drops: { priority_games: v } })}
        />
      </Section>

      <Section
        title="Excluded games"
        description="Never farm drops for these games."
      >
        <ListEditor
          items={drops.exclude}
          placeholder="e.g. Just Chatting"
          onChange={(v) => save({ drops: { exclude: v } })}
        />
      </Section>

      <Section title="Advanced">
        <Field label="Proxy (optional)" hint="socks5:// or http://">
          <TextInput
            value={drops.proxy}
            placeholder="leave blank for direct connection"
            onChange={(e) => save({ drops: { proxy: e.target.value } })}
          />
        </Field>
      </Section>

      {!drops.enabled && (
        <Card className="border-dashed p-5 text-center text-xs text-[var(--color-muted)]">
          Drops engine is disabled. Enable it above, then press Start on the Drops miner.
        </Card>
      )}
    </div>
  );
}
