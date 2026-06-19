import { useState } from "react";
import { KeyRound, Copy, CheckCircle2, Tv, X, Loader2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { useStore } from "../lib/store";
import { Button } from "./ui";

export function LoginModal() {
  const prompt = useStore((s) => s.loginPrompt);
  const dismiss = useStore((s) => s.dismissLogin);
  const [copied, setCopied] = useState(false);
  if (!prompt) return null;

  const engineLabel = prompt.engine === "points" ? "Points & Predictions" : "Drops";

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 backdrop-blur-sm">
      <div className="fade-in w-[min(440px,92vw)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-accent)] text-white shadow-[0_8px_24px_-8px_var(--color-accent)]">
              <KeyRound size={20} />
            </div>
            <div>
              <div className="text-base font-semibold">Sign in to Twitch</div>
              <div className="text-xs text-[var(--color-muted)]">Required to start {engineLabel}</div>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          >
            <X size={16} />
          </button>
        </div>

        <ol className="mt-5 space-y-3 text-sm">
          <li className="flex items-start gap-2.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-[11px] text-[var(--color-muted)]">1</span>
            <span>Open the Twitch activation page.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-[11px] text-[var(--color-muted)]">2</span>
            <span>Enter this code and approve the login.</span>
          </li>
        </ol>

        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] py-4">
          <code className="font-mono text-3xl font-semibold tracking-[0.35em] text-[var(--color-accent-soft)]">
            {prompt.code}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(prompt.code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="grid h-9 w-9 place-items-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
            title="Copy code"
          >
            {copied ? <CheckCircle2 size={18} className="text-[var(--color-good)]" /> : <Copy size={18} />}
          </button>
        </div>

        <Button
          variant="primary"
          className="mt-4 w-full py-2.5"
          onClick={() => open(prompt.uri).catch(() => {})}
        >
          <Tv size={15} /> Open activation page
        </Button>

        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[var(--color-muted)]">
          <Loader2 size={13} className="animate-spin" />
          Waiting for you to approve… this closes automatically.
        </div>
      </div>
    </div>
  );
}
