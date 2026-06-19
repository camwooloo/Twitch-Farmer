import { useEffect, useMemo, useState } from "react";
import { TrendingUp, RefreshCw, Gift, Trophy } from "lucide-react";
import { useStore } from "../lib/store";
import { Section, Button, Badge } from "../components/ui";
import clsx from "clsx";

type Series = Record<string, { x: number; y: number }[]>;

const PALETTE = ["#9146ff", "#2dd4a7", "#ffb454", "#4f8cff", "#ff5d6c", "#a970ff", "#3ad1c8"];
const RANGES: { key: string; label: string; ms: number }[] = [
  { key: "24h", label: "24h", ms: 24 * 3600e3 },
  { key: "7d", label: "7 days", ms: 7 * 24 * 3600e3 },
  { key: "all", label: "All", ms: Infinity },
];

function LineChart({
  data,
  height = 260,
}: {
  data: { label: string; color: string; points: { x: number; y: number }[] }[];
  height?: number;
}) {
  const W = 760;
  const H = height;
  const pad = { l: 56, r: 16, t: 16, b: 28 };
  const all = data.flatMap((d) => d.points);
  if (all.length === 0) return null;
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  let minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  if (minX === maxX) maxX = minX + 1;
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const yPad = (maxY - minY) * 0.08;
  minY -= yPad; maxY += yPad;
  const sx = (x: number) => pad.l + ((x - minX) / (maxX - minX)) * (W - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - (y - minY) / (maxY - minY)) * (H - pad.t - pad.b);
  const ticks = Array.from({ length: 5 }, (_, i) => minY + (i / 4) * (maxY - minY));
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : Math.round(n).toString());
  const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: H }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="var(--color-border)" strokeWidth={1} />
          <text x={pad.l - 8} y={sy(t) + 4} textAnchor="end" fontSize={11} fill="var(--color-muted)">{fmt(t)}</text>
        </g>
      ))}
      <text x={pad.l} y={H - 8} textAnchor="start" fontSize={11} fill="var(--color-muted)">{fmtDate(minX)}</text>
      <text x={W - pad.r} y={H - 8} textAnchor="end" fontSize={11} fill="var(--color-muted)">{fmtDate(maxX)}</text>
      {data.map((d) => {
        if (!d.points.length) return null;
        const pts = d.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ");
        return (
          <g key={d.label}>
            <polyline points={pts} fill="none" stroke={d.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {d.points.length === 1 && <circle cx={sx(d.points[0].x)} cy={sy(d.points[0].y)} r={3} fill={d.color} />}
          </g>
        );
      })}
    </svg>
  );
}

export function Analytics() {
  const fetchAnalytics = useStore((s) => s.fetchAnalytics);
  const config = useStore((s) => s.config)!;
  const recentClaimed = useStore((s) => s.dropsLive.recentClaimed);
  const [series, setSeries] = useState<Series>({});
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("7d");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setSeries(await fetchAnalytics());
    setLoading(false);
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rangeMs = RANGES.find((r) => r.key === range)!.ms;
  const cutoff = rangeMs === Infinity ? 0 : Date.now() - rangeMs;
  const last = (pts: { x: number; y: number }[]) => (pts.length ? pts[pts.length - 1].y : 0);

  const streamers = useMemo(
    () => Object.entries(series).filter(([, pts]) => pts.length > 0),
    [series],
  );
  const avatarOf = (username: string) =>
    config.streamers.find((s) => s.username.toLowerCase() === username.toLowerCase())?.avatar;

  const chartData = streamers
    .filter(([name]) => !hidden.has(name))
    .map(([name, pts], i) => ({
      label: name,
      color: PALETTE[i % PALETTE.length],
      points: pts.filter((p) => p.x >= cutoff),
    }));
  const totalNow = streamers.reduce((s, [, pts]) => s + last(pts), 0);

  // gain over the selected window
  const gain = streamers.reduce((sum, [, pts]) => {
    const inRange = pts.filter((p) => p.x >= cutoff);
    if (inRange.length < 2) return sum;
    return sum + (inRange[inRange.length - 1].y - inRange[0].y);
  }, 0);

  return (
    <div className="space-y-6">
      <Section
        title="Points over time"
        description="Channel-point balance per streamer, recorded while the points miner runs."
        right={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-[var(--color-border)] p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={clsx(
                    "rounded-md px-2.5 py-1 text-xs transition",
                    range === r.key
                      ? "bg-[var(--color-accent)]/20 text-[var(--color-accent-soft)]"
                      : "text-[var(--color-muted)] hover:text-[var(--color-text)]",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <Button variant="ghost" onClick={load}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-[var(--color-bg-soft)] px-3 py-2">
            <Trophy size={15} className="text-[var(--color-warn)]" />
            <span className="text-xs text-[var(--color-muted)]">Total</span>
            <span className="text-sm font-semibold">{totalNow.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-[var(--color-bg-soft)] px-3 py-2">
            <TrendingUp size={15} className={gain >= 0 ? "text-[var(--color-good)]" : "text-[var(--color-bad)]"} />
            <span className="text-xs text-[var(--color-muted)]">{range} gain</span>
            <span className={clsx("text-sm font-semibold", gain >= 0 ? "text-[var(--color-good)]" : "text-[var(--color-bad)]")}>
              {gain >= 0 ? "+" : ""}{gain.toLocaleString()}
            </span>
          </div>
        </div>

        {chartData.some((d) => d.points.length) ? (
          <>
            <LineChart data={chartData} />
            <div className="flex flex-wrap gap-2 pt-1">
              {streamers.map(([name], i) => {
                const off = hidden.has(name);
                const av = avatarOf(name);
                return (
                  <button
                    key={name}
                    onClick={() =>
                      setHidden((h) => {
                        const n = new Set(h);
                        n.has(name) ? n.delete(name) : n.add(name);
                        return n;
                      })
                    }
                    className={clsx(
                      "flex items-center gap-2 rounded-lg border px-2 py-1 text-xs transition",
                      off ? "border-[var(--color-border)] opacity-40" : "border-[var(--color-border)]",
                    )}
                  >
                    {av ? (
                      <img src={av} alt="" className="h-5 w-5 rounded-full object-cover" />
                    ) : (
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                    )}
                    <span className="text-[var(--color-text)]">{name}</span>
                    <span className="text-[var(--color-muted)]">{last(series[name]).toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="grid place-items-center gap-2 py-10 text-center text-sm text-[var(--color-muted)]">
            <TrendingUp size={26} className="text-[var(--color-border)]" />
            {loading ? "Loading…" : "No data in this range yet. Run the points miner to build history."}
          </div>
        )}
      </Section>

      <Section
        title="Recently claimed drops"
        description="Rewards claimed during this session."
        right={<Badge tone="accent">{recentClaimed.length}</Badge>}
      >
        {recentClaimed.length ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recentClaimed.slice(0, 12).map((d, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5">
                {d.image ? (
                  <img src={d.image} alt="" className="h-9 w-9 rounded-md object-cover" />
                ) : (
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--color-surface)] text-[var(--color-good)]">
                    <Gift size={16} />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm">{d.name}</div>
                  {d.game && <div className="text-xs text-[var(--color-muted)]">{d.game}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-[var(--color-muted)]">
            Claimed drops will appear here while the drops miner runs.
          </div>
        )}
      </Section>
    </div>
  );
}
