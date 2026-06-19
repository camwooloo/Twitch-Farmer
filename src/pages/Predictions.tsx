import { Dices, Play, Square } from "lucide-react";
import { useStore } from "../lib/store";
import { Section, Field, TextInput, Select, Toggle, Card, Button } from "../components/ui";

const STRATEGIES = ["MOST_VOTED", "HIGH_ODDS", "PERCENTAGE", "SMART_MONEY", "SMART"];
const DELAY_MODES = ["FROM_START", "FROM_END", "PERCENTAGE"];
const FILTER_BY = [
  "PERCENTAGE_USERS", "ODDS_PERCENTAGE", "ODDS", "TOP_POINTS", "TOTAL_USERS", "TOTAL_POINTS",
];
const WHERE = ["GT", "LT", "GTE", "LTE"];

function NumField({
  label, value, onChange, hint,
}: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <TextInput type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  );
}

export function Predictions() {
  const config = useStore((s) => s.config)!;
  const save = useStore((s) => s.saveConfig);
  const predictions = useStore((s) => s.predictions);
  const points = useStore((s) => s.points);
  const control = useStore((s) => s.control);
  const bet = config.streamer_settings.bet;

  return (
    <div className="space-y-6">
      <Card className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent-soft)]">
            <Dices size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold">Predictions</div>
            <div className="text-xs text-[var(--color-muted)]">
              Auto-bets on channel predictions while watching
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Toggle
            checked={config.predictions_enabled}
            onChange={(v) => save({ predictions_enabled: v })}
          />
          <Button
            variant={predictions.running ? "danger" : "primary"}
            onClick={() => control("predictions", predictions.running ? "stop" : "start")}
          >
            {predictions.running ? <Square size={14} /> : <Play size={14} />}
            {predictions.running ? "Stop" : "Start"}
          </Button>
        </div>
      </Card>

      {points.running && !predictions.running && (
        <Card className="border-dashed p-3 text-center text-xs text-[var(--color-muted)]">
          The points miner is running without betting. Starting Predictions restarts it with betting on.
        </Card>
      )}

      <Section title="Strategy" description="How predictions are placed.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Strategy">
            <Select
              value={bet.strategy}
              options={STRATEGIES.map((s) => ({ value: s, label: s }))}
              onChange={(e) => save({ streamer_settings: { bet: { strategy: e.target.value } } })}
            />
          </Field>
          <NumField label="Percentage of points" hint="% of balance" value={bet.percentage} onChange={(v) => save({ streamer_settings: { bet: { percentage: v } } })} />
          <NumField label="Percentage gap" hint="SMART strategy" value={bet.percentage_gap} onChange={(v) => save({ streamer_settings: { bet: { percentage_gap: v } } })} />
          <NumField label="Max points" value={bet.max_points} onChange={(v) => save({ streamer_settings: { bet: { max_points: v } } })} />
          <NumField label="Minimum points to bet" value={bet.minimum_points} onChange={(v) => save({ streamer_settings: { bet: { minimum_points: v } } })} />
          <Field label="Delay mode">
            <Select
              value={bet.delay_mode}
              options={DELAY_MODES.map((s) => ({ value: s, label: s }))}
              onChange={(e) => save({ streamer_settings: { bet: { delay_mode: e.target.value } } })}
            />
          </Field>
          <NumField label="Delay (seconds)" value={bet.delay} onChange={(v) => save({ streamer_settings: { bet: { delay: v } } })} />
        </div>
        <Toggle
          label="Stealth mode"
          description="Cap the bet at the highest existing bet minus 1–2 points"
          checked={bet.stealth_mode}
          onChange={(v) => save({ streamer_settings: { bet: { stealth_mode: v } } })}
        />
      </Section>

      <Section title="Skip filter" description="Only place a bet when this condition holds.">
        <div className="grid grid-cols-3 gap-3">
          <Field label="By">
            <Select
              value={bet.filter_condition.by}
              options={FILTER_BY.map((s) => ({ value: s, label: s }))}
              onChange={(e) => save({ streamer_settings: { bet: { filter_condition: { by: e.target.value } } } })}
            />
          </Field>
          <Field label="Where">
            <Select
              value={bet.filter_condition.where}
              options={WHERE.map((s) => ({ value: s, label: s }))}
              onChange={(e) => save({ streamer_settings: { bet: { filter_condition: { where: e.target.value } } } })}
            />
          </Field>
          <NumField label="Value" value={bet.filter_condition.value} onChange={(v) => save({ streamer_settings: { bet: { filter_condition: { value: v } } } })} />
        </div>
      </Section>
    </div>
  );
}
