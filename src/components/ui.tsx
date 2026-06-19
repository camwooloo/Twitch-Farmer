import { forwardRef, type ReactNode } from "react";
import clsx from "clsx";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 backdrop-blur-sm shadow-[0_10px_40px_-20px_rgba(0,0,0,0.8)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Section({
  title,
  description,
  right,
  children,
}: {
  title: string;
  description?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-[var(--color-text)]">
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">{description}</p>
          )}
        </div>
        {right}
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium text-[var(--color-text)]">{label}</span>
        {hint && <span className="text-[10px] text-[var(--color-muted)]">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => (
    <input
      ref={ref}
      {...props}
      className={clsx(
        "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition",
        "placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30",
        props.className,
      )}
    />
  ),
);
TextInput.displayName = "TextInput";

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] },
) {
  const { options, ...rest } = props;
  return (
    <select
      {...rest}
      className={clsx(
        "w-full appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition",
        "focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30",
        rest.className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 text-left"
    >
      {(label || description) && (
        <span className="min-w-0">
          {label && (
            <span className="block text-sm font-medium text-[var(--color-text)]">
              {label}
            </span>
          )}
          {description && (
            <span className="block text-xs text-[var(--color-muted)]">{description}</span>
          )}
        </span>
      )}
      <span
        className={clsx(
          "relative h-6 w-11 shrink-0 rounded-full border transition",
          checked
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
            : "border-[var(--color-border)] bg-[var(--color-surface-2)]",
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-all",
            checked ? "left-5.5" : "left-0.5",
          )}
          style={{ height: 18, width: 18, left: checked ? 22 : 3 }}
        />
      </span>
    </button>
  );
}

export function Button({
  children,
  variant = "default",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "ghost";
}) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-soft)] shadow-[0_8px_24px_-8px_var(--color-accent)]",
        variant === "danger" &&
          "bg-[var(--color-bad)]/15 text-[var(--color-bad)] hover:bg-[var(--color-bad)]/25",
        variant === "ghost" &&
          "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]",
        variant === "default" &&
          "border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] hover:border-[var(--color-accent)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "bad" | "warn" | "accent";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
    good: "bg-[var(--color-good)]/15 text-[var(--color-good)]",
    bad: "bg-[var(--color-bad)]/15 text-[var(--color-bad)]",
    warn: "bg-[var(--color-warn)]/15 text-[var(--color-warn)]",
    accent: "bg-[var(--color-accent)]/15 text-[var(--color-accent-soft)]",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
