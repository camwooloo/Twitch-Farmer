import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, Award, Eye, Star, CheckCircle2 } from "lucide-react";
import { useStore } from "../lib/store";
import type { BadgeCategories, BadgeItem } from "../lib/store";
import { Section, Card, TextInput, Toggle } from "../components/ui";
import clsx from "clsx";

function BadgeGrid({ items, filter }: { items: BadgeItem[]; filter: string }) {
  const shown = items.filter((b) =>
    filter === "owned" ? b.owned : filter === "missing" ? !b.owned : true,
  );
  if (shown.length === 0) {
    return <p className="py-6 text-center text-xs text-[var(--color-muted)]">Nothing here.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {shown.map((b) => (
        <div
          key={b.id}
          title={b.id}
          className={clsx(
            "flex items-center gap-2.5 rounded-lg border p-2.5 transition",
            b.owned
              ? "border-[var(--color-good)]/40 bg-[var(--color-good)]/5"
              : "border-[var(--color-border)] bg-[var(--color-surface-2)] opacity-75",
          )}
        >
          <div className="relative shrink-0">
            {b.image ? (
              <img src={b.image} alt="" className={clsx("h-8 w-8 rounded", !b.owned && "grayscale")} />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded bg-[var(--color-surface)] text-[var(--color-muted)]">
                <Award size={15} />
              </span>
            )}
            {b.owned && (
              <CheckCircle2
                size={13}
                className="absolute -bottom-1 -right-1 rounded-full bg-[var(--color-surface)] text-[var(--color-good)]"
              />
            )}
          </div>
          <span className="min-w-0 truncate text-xs">{b.title}</span>
        </div>
      ))}
    </div>
  );
}

export function Badges() {
  const fetchBadges = useStore((s) => s.fetchBadges);
  const config = useStore((s) => s.config)!;
  const save = useStore((s) => s.saveConfig);
  const [cats, setCats] = useState<BadgeCategories | null>(null);
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState("all"); // all | owned | missing

  useEffect(() => {
    fetchBadges().then(setCats);
  }, [fetchBadges]);

  const search = (items: BadgeItem[]) => {
    const term = q.trim().toLowerCase();
    return term ? items.filter((b) => b.title.toLowerCase().includes(term)) : items;
  };

  const ownedTotal = useMemo(() => {
    if (!cats) return 0;
    return Object.values(cats).flat().filter((b) => b.owned).length;
  }, [cats]);

  if (!cats) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--color-muted)]">
        <Loader2 size={16} className="animate-spin" /> Loading Twitch badges…
      </div>
    );
  }

  const FILTERS = [
    { key: "all", label: "All" },
    { key: "owned", label: `Owned (${ownedTotal})` },
    { key: "missing", label: "Not owned" },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <Toggle
          label="Prioritise badge & emote drops"
          description="Always farm badge/emote drop campaigns first (same setting as the Drops tab)."
          checked={config.drops.farm_badges}
          onChange={(v) => save({ drops: { farm_badges: v } })}
        />
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
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
          <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="accent-[var(--color-accent)]"
            />
            Show all categories
          </label>
          <div className="relative w-44">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
            <TextInput value={q} placeholder="Search badges…" className="pl-8 py-1.5 text-xs" onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      <Section
        title="Earned by watching"
        description="Limited-time badges from watching games, esports and Twitch events."
        right={<Eye size={16} className="text-[var(--color-accent-soft)]" />}
      >
        <BadgeGrid items={search(cats.watch)} filter={filter} />
      </Section>

      <Section
        title="Earned by subscribing"
        description="Subscriber, gifter and founder badges."
        right={<Star size={16} className="text-[var(--color-warn)]" />}
      >
        <BadgeGrid items={search(cats.subscription)} filter={filter} />
      </Section>

      {showAll && (
        <>
          <Section title="Bits & cheering">
            <BadgeGrid items={search(cats.bits)} filter={filter} />
          </Section>
          <Section title="Status & role">
            <BadgeGrid items={search(cats.status)} filter={filter} />
          </Section>
        </>
      )}

      <p className="px-1 pb-4 text-[11px] text-[var(--color-muted)]">
        Owned badges are highlighted with a ✓. Twitch's catalog doesn't flag which limited-time
        badges are currently active vs retired, so the full list is shown — use “Not owned” to find
        ones you're missing.
      </p>
    </div>
  );
}
