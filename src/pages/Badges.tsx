import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, Award } from "lucide-react";
import { useStore } from "../lib/store";
import type { BadgeCategories, BadgeItem } from "../lib/store";
import { Section, Card, TextInput, Badge } from "../components/ui";

const TABS: { key: keyof BadgeCategories; label: string; desc: string }[] = [
  { key: "watch", label: "Watch & Event", desc: "Earned by watching games, esports and Twitch events" },
  { key: "subscription", label: "Subscription", desc: "Subscriber, gifter and founder badges" },
  { key: "bits", label: "Bits", desc: "Cheering and bits badges" },
  { key: "status", label: "Status & Role", desc: "Staff, moderator, partner, turbo and more" },
];

function BadgeGrid({ items }: { items: BadgeItem[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-xs text-[var(--color-muted)]">No badges match.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {items.map((b) => (
        <div
          key={b.id}
          className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5"
          title={b.id}
        >
          {b.image ? (
            <img src={b.image} alt="" className="h-8 w-8 shrink-0 rounded" />
          ) : (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-[var(--color-surface)] text-[var(--color-muted)]">
              <Award size={15} />
            </span>
          )}
          <span className="min-w-0 truncate text-xs">{b.title}</span>
        </div>
      ))}
    </div>
  );
}

export function Badges() {
  const fetchBadges = useStore((s) => s.fetchBadges);
  const [cats, setCats] = useState<BadgeCategories | null>(null);
  const [tab, setTab] = useState<keyof BadgeCategories>("watch");
  const [q, setQ] = useState("");

  useEffect(() => {
    fetchBadges().then(setCats);
  }, [fetchBadges]);

  const filtered = useMemo(() => {
    if (!cats) return [];
    const term = q.trim().toLowerCase();
    return cats[tab].filter((b) => !term || b.title.toLowerCase().includes(term));
  }, [cats, tab, q]);

  if (!cats) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--color-muted)]">
        <Loader2 size={16} className="animate-spin" /> Loading Twitch badges…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 p-4 text-xs text-[var(--color-muted)]">
        Every chat badge currently on Twitch, pulled live from Twitch's badge catalog (the same
        source sites like streamdatabase use). <b className="text-[var(--color-text)]">Watch &amp; Event</b>{" "}
        badges are the limited-time ones you earn by watching specific games or events.
      </Card>

      <Section
        title="Twitch badges"
        right={
          <div className="relative w-44">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
            <TextInput
              value={q}
              placeholder="Search badges…"
              className="pl-8 py-1.5 text-xs"
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition " +
                (tab === t.key
                  ? "bg-[var(--color-accent)]/20 text-[var(--color-accent-soft)]"
                  : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]")
              }
            >
              {t.label}
              <Badge tone="neutral">{cats[t.key].length}</Badge>
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--color-muted)]">{TABS.find((t) => t.key === tab)!.desc}</p>
        <BadgeGrid items={filtered} />
      </Section>
    </div>
  );
}
