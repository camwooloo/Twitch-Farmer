import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, Award, Eye, Star, CheckCircle2, Sparkles, Play } from "lucide-react";
import { useStore } from "../lib/store";
import type { BadgeCategories, BadgeItem } from "../lib/store";
import { Section, Card, TextInput, Toggle, Badge, Button } from "../components/ui";
import clsx from "clsx";

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

// badge/emote drops the drops engine can auto-farm right now
function EarnableNow() {
  const live = useStore((s) => s.dropsLive);
  const drops = useStore((s) => s.drops);
  const config = useStore((s) => s.config)!;
  const save = useStore((s) => s.saveConfig);
  const control = useStore((s) => s.control);

  const items = live.campaigns.flatMap((c) =>
    (c.drops || [])
      .filter((d) => d.category === "badge" || d.category === "emote")
      .map((d) => ({ ...d, game: c.game, active: c.active, linked: c.linked })),
  );

  return (
    <Card className="border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Sparkles size={18} className="text-[var(--color-accent-soft)]" />
          <div>
            <div className="text-sm font-semibold">Earnable now — auto-farmed</div>
            <div className="text-xs text-[var(--color-muted)]">
              Badge &amp; emote drops the Drops miner can earn for you automatically.
            </div>
          </div>
        </div>
        <Toggle
          label="Prioritise"
          checked={config.drops.farm_badges}
          onChange={(v) => save({ drops: { farm_badges: v } })}
        />
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((d, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2">
              {d.image ? (
                <img src={d.image} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
              ) : (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-[var(--color-surface)] text-[var(--color-accent-soft)]">
                  <Award size={15} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{d.name}</span>
                  <span className="shrink-0 text-[var(--color-muted)]">
                    {Math.min(d.current, d.required)}/{d.required}m
                  </span>
                </div>
                <div className="mb-1 truncate text-[10px] text-[var(--color-muted)]">{d.game}</div>
                <ProgressBar value={d.required ? d.current / d.required : d.claimed ? 1 : 0} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-3 text-center text-xs text-[var(--color-muted)]">
          {drops.running
            ? "No badge/emote drops available right now — they'll appear here when a campaign is active."
            : "Start the Drops miner to find and auto-farm badge & emote drops."}
          {!drops.running && (
            <Button variant="primary" onClick={() => control("drops", "start")}>
              <Play size={14} /> Start drops
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function BadgeRow({ b }: { b: BadgeItem }) {
  return (
    <div
      className={clsx(
        "flex items-start gap-3 rounded-lg border p-2.5 transition",
        b.owned
          ? "border-[var(--color-good)]/40 bg-[var(--color-good)]/5"
          : "border-[var(--color-border)] bg-[var(--color-surface-2)]",
      )}
    >
      <div className="relative shrink-0">
        {b.image ? (
          <img src={b.image} alt="" className={clsx("h-9 w-9 rounded", !b.owned && "opacity-80")} />
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded bg-[var(--color-surface)] text-[var(--color-muted)]">
            <Award size={16} />
          </span>
        )}
        {b.owned && (
          <CheckCircle2 size={13} className="absolute -bottom-1 -right-1 rounded-full bg-[var(--color-surface)] text-[var(--color-good)]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{b.title}</span>
          {b.owned && <Badge tone="good">owned</Badge>}
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-muted)]">
          {b.description || "No earn details provided by Twitch."}
        </p>
      </div>
    </div>
  );
}

function BadgeList({ items, filter, sort, q }: { items: BadgeItem[]; filter: string; sort: string; q: string }) {
  const term = q.trim().toLowerCase();
  let shown = items.filter((b) => {
    if (filter === "owned" && !b.owned) return false;
    if (filter === "missing" && b.owned) return false;
    if (term && !(b.title.toLowerCase().includes(term) || b.description.toLowerCase().includes(term))) return false;
    return true;
  });
  shown = [...shown].sort((a, b) =>
    sort === "name"
      ? a.title.localeCompare(b.title)
      : (a.owned === b.owned ? a.title.localeCompare(b.title) : a.owned ? -1 : 1),
  );
  if (shown.length === 0) return <p className="py-4 text-center text-xs text-[var(--color-muted)]">Nothing here.</p>;
  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
      {shown.map((b) => <BadgeRow key={b.id} b={b} />)}
    </div>
  );
}

export function Badges() {
  const fetchBadges = useStore((s) => s.fetchBadges);
  const [cats, setCats] = useState<BadgeCategories | null>(null);
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("owned");

  useEffect(() => {
    fetchBadges().then(setCats);
  }, [fetchBadges]);

  const ownedTotal = useMemo(
    () => (cats ? Object.values(cats).flat().filter((b) => b.owned).length : 0),
    [cats],
  );

  if (!cats) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--color-muted)]">
        <Loader2 size={16} className="animate-spin" /> Loading Twitch badges…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <EarnableNow />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: "all", label: "All" },
            { key: "owned", label: `Owned (${ownedTotal})` },
            { key: "missing", label: "Not owned" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={clsx(
                "rounded-lg px-2.5 py-1 text-xs transition",
                filter === f.key
                  ? "bg-[var(--color-accent)]/20 text-[var(--color-accent-soft)]"
                  : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-2 py-1.5 text-xs text-[var(--color-text)] outline-none"
          >
            <option value="owned">Owned first</option>
            <option value="name">Name (A–Z)</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-[var(--color-accent)]" />
            Show all
          </label>
          <div className="relative w-40">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
            <TextInput value={q} placeholder="Search…" className="pl-8 py-1.5 text-xs" onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      <Section
        title="Earned by watching"
        description="Badges earned by watching games, esports and Twitch events."
        right={<span className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]"><Eye size={14} /> {cats.watch.length}</span>}
      >
        <BadgeList items={cats.watch} filter={filter} sort={sort} q={q} />
      </Section>

      <Section
        title="Earned by subscribing"
        description="Badges from subscribing or gifting subs to channels in specific games/events."
        right={<span className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]"><Star size={14} /> {cats.subscription.length}</span>}
      >
        <BadgeList items={cats.subscription} filter={filter} sort={sort} q={q} />
      </Section>

      {showAll && (
        <>
          <Section title="Other & legacy game badges" description="Older badges where Twitch doesn't state how they were earned.">
            <BadgeList items={cats.other} filter={filter} sort={sort} q={q} />
          </Section>
          <Section title="Bits & cheering">
            <BadgeList items={cats.bits} filter={filter} sort={sort} q={q} />
          </Section>
          <Section title="Status & role">
            <BadgeList items={cats.status} filter={filter} sort={sort} q={q} />
          </Section>
        </>
      )}

      <p className="px-1 pb-4 text-[11px] text-[var(--color-muted)]">
        “How to earn” comes straight from Twitch's badge data. Twitch doesn't publish how many people
        own each badge, so rarity sorting isn't available — owned badges are marked with a ✓ instead.
      </p>
    </div>
  );
}
