import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useStore } from "../lib/store";
import { Card, Button, Select } from "../components/ui";

const LEVEL_COLORS: Record<string, string> = {
  error: "var(--color-bad)",
  warning: "var(--color-warn)",
  info: "var(--color-text)",
  debug: "var(--color-muted)",
};

export function Logs() {
  const logs = useStore((s) => s.logs);
  const [source, setSource] = useState("all");
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState(logs);
  const endRef = useRef<HTMLDivElement>(null);

  const view = paused ? frozen : logs;
  const sources = useMemo(
    () => ["all", ...Array.from(new Set(logs.map((l) => l.source)))],
    [logs],
  );
  const filtered = view.filter((l) => source === "all" || l.source === source);

  useEffect(() => {
    if (!paused) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filtered.length, paused]);

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="w-48">
          <Select
            value={source}
            options={sources.map((s) => ({ value: s, label: s === "all" ? "All sources" : s }))}
            onChange={(e) => setSource(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              if (!paused) setFrozen(logs);
              setPaused(!paused);
            }}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
            {paused ? "Resume" : "Pause"}
          </Button>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden p-0">
        <div className="h-full overflow-y-auto p-4 font-mono text-xs leading-relaxed">
          {filtered.map((l, i) => (
            <div key={i} className="flex gap-3">
              <span className="shrink-0 text-[var(--color-muted)]">
                {new Date(l.ts * 1000).toLocaleTimeString()}
              </span>
              <span
                className="w-14 shrink-0 truncate uppercase"
                style={{ color: "var(--color-accent-soft)" }}
              >
                {l.source}
              </span>
              <span
                className="whitespace-pre-wrap break-words"
                style={{ color: LEVEL_COLORS[l.level] ?? "var(--color-text)" }}
              >
                {l.message}
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="grid h-full place-items-center text-[var(--color-muted)]">
              No logs yet — start a miner to see live output.
            </div>
          )}
          <div ref={endRef} />
        </div>
      </Card>
    </div>
  );
}
