import { Coins, Gift, Users, Activity, Play, Square, Sprout, Dices, Tv, Radio } from "lucide-react";
import { useStore } from "../lib/store";
import { Card, Button, Badge, Section } from "../components/ui";
import { SpadeBanner } from "../components/SpadeBanner";
import { Analytics } from "./Analytics";
import clsx from "clsx";

function CurrentlyFarming() {
  const config = useStore((s) => s.config)!;
  const status = useStore((s) => s.streamerStatus);
  const live = useStore((s) => s.dropsLive);
  const points = useStore((s) => s.points);
  const drops = useStore((s) => s.drops);

  const onlineChannels = config.streamers.filter((s) => status[s.username]?.online);
  const showPoints = points.running;
  const showDrops = drops.running && (live.watching?.channel || live.currentDrop);
  if (!showPoints && !showDrops) return null;

  return (
    <Section title="Currently farming" description="What each engine is working on right now.">
      {showPoints && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)]">
            <Coins size={13} className="text-[var(--color-accent-soft)]" /> Points
          </div>
          {onlineChannels.length ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {onlineChannels.map((s) => (
                <div key={s.username} className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2">
                  {s.avatar ? (
                    <img src={s.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-[var(--color-surface)]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{s.display_name || s.username}</div>
                    <div className="flex items-center gap-1 text-[11px] text-[var(--color-good)]">
                      <Radio size={10} /> Live{status[s.username]?.points ? ` · ${status[s.username].points} pts` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-muted)]">Waiting for a followed channel to go live…</p>
          )}
        </div>
      )}
      {showDrops && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)]">
            <Gift size={13} className="text-[var(--color-good)]" /> Drops
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5 text-sm">
            <Tv size={15} className="text-[var(--color-good)]" />
            {live.watching?.channel ? <b>{live.watching.channel}</b> : "finding a channel…"}
            {live.watching?.game && <Badge tone="neutral">{live.watching.game}</Badge>}
            {live.currentDrop && (
              <span className="text-[var(--color-muted)]">
                for <b className="text-[var(--color-text)]">{live.currentDrop.name}</b>
                {" "}({live.currentDrop.current}/{live.currentDrop.required}m)
              </span>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

function Hero() {
  const points = useStore((s) => s.points);
  const drops = useStore((s) => s.drops);
  const config = useStore((s) => s.config)!;
  const control = useStore((s) => s.control);
  const running = points.running || drops.running;

  const enabled: string[] = [];
  if (config.points_enabled) enabled.push("points");
  if (config.predictions_enabled) enabled.push("predictions");
  if (config.drops.enabled) enabled.push("drops");

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div
            className={clsx(
              "grid h-14 w-14 place-items-center rounded-2xl transition",
              running
                ? "bg-[var(--color-good)]/15 text-[var(--color-good)]"
                : "bg-[var(--color-accent)] text-white shadow-[0_10px_30px_-8px_var(--color-accent)]",
            )}
          >
            <Sprout size={26} />
          </div>
          <div>
            <div className="text-lg font-semibold">
              {running ? "Farming in progress" : "Ready to farm"}
            </div>
            <div className="text-xs text-[var(--color-muted)]">
              {enabled.length
                ? `One click runs ${enabled.join(" + ")}`
                : "Enable an engine in Points or Drops first"}
            </div>
          </div>
        </div>
        <Button
          variant={running ? "danger" : "primary"}
          className="px-6 py-3 text-base"
          onClick={() => control("all", running ? "stop" : "start")}
        >
          {running ? <Square size={16} /> : <Play size={16} />}
          {running ? "Stop farming" : "Start farming"}
        </Button>
      </div>
    </Card>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div
          className="grid h-10 w-10 place-items-center rounded-xl"
          style={{ background: `${tone}22`, color: tone }}
        >
          <Icon size={18} />
        </div>
        <div>
          <div className="text-xs text-[var(--color-muted)]">{label}</div>
          <div className="text-lg font-semibold">{value}</div>
        </div>
      </div>
    </Card>
  );
}

function EngineCard({
  title,
  icon: Icon,
  engine,
  running,
  status,
  detail,
}: {
  title: string;
  icon: any;
  engine: "points" | "predictions" | "drops";
  running: boolean;
  status: string;
  detail: string;
}) {
  const control = useStore((s) => s.control);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent-soft)]">
            <Icon size={18} />
          </div>
          <div>
            <div className="font-semibold">{title}</div>
            <div className="text-xs text-[var(--color-muted)]">{detail}</div>
          </div>
        </div>
        <Badge tone={running ? "good" : "neutral"}>
          <span
            className={clsx(
              "h-1.5 w-1.5 rounded-full",
              running ? "bg-[var(--color-good)] live-dot" : "bg-[var(--color-muted)]",
            )}
          />
          {status}
        </Badge>
      </div>
      <div className="mt-4">
        <Button
          variant={running ? "danger" : "primary"}
          onClick={() => control(engine, running ? "stop" : "start")}
        >
          {running ? <Square size={14} /> : <Play size={14} />}
          {running ? "Stop" : "Start"}
        </Button>
      </div>
    </Card>
  );
}

export function Dashboard() {
  const points = useStore((s) => s.points);
  const predictions = useStore((s) => s.predictions);
  const drops = useStore((s) => s.drops);
  const config = useStore((s) => s.config)!;
  const logs = useStore((s) => s.logs);

  return (
    <div className="space-y-6">
      <SpadeBanner />
      <Hero />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat icon={Users} label="Streamers" value={String(config.streamers.length)} tone="#9146ff" />
        <Stat
          icon={Gift}
          label="Drops mode"
          value={config.drops.mine_all ? "All games" : `${config.drops.priority_games.length} games`}
          tone="#2dd4a7"
        />
        <Stat
          icon={Coins}
          label="Predictions"
          value={config.predictions_enabled ? "On" : "Off"}
          tone="#ffb454"
        />
        <Stat
          icon={Activity}
          label="Account"
          value={config.username || "—"}
          tone="#a970ff"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <EngineCard
          title="Points"
          icon={Coins}
          engine="points"
          running={points.running}
          status={points.status}
          detail="Watch streaks · raids · moments"
        />
        <EngineCard
          title="Predictions"
          icon={Dices}
          engine="predictions"
          running={predictions.running}
          status={predictions.status}
          detail="Auto-bet on predictions"
        />
        <EngineCard
          title="Drops"
          icon={Gift}
          engine="drops"
          running={drops.running}
          status={drops.status}
          detail="Campaigns · badges · emotes"
        />
      </div>

      <CurrentlyFarming />

      <Analytics />

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent activity</h3>
          <Badge tone="accent">{logs.length} lines</Badge>
        </div>
        <div className="space-y-1 font-mono text-xs">
          {logs.slice(-8).reverse().map((l, i) => (
            <div key={i} className="flex gap-2 text-[var(--color-muted)]">
              <span className="text-[var(--color-accent-soft)]">{l.source}</span>
              <span className="truncate text-[var(--color-text)]">{l.message}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-[var(--color-muted)]">No activity yet. Start a miner to see live logs.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
