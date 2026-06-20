import { useState } from "react";
import { Sparkles, Download, X, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { useStore, isNewer } from "../lib/store";
import { Button } from "./ui";

// render inline markdown: **bold**, `code`, [text](url)
function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<b key={k++} className="text-[var(--color-text)]">{m[1]}</b>);
    else if (m[2]) parts.push(<code key={k++} className="rounded bg-[var(--color-bg)] px-1 text-[var(--color-accent-soft)]">{m[2]}</code>);
    else if (m[3]) parts.push(
      <a key={k++} href={m[4]} target="_blank" rel="noreferrer" className="text-[var(--color-accent-soft)] underline">{m[3]}</a>,
    );
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// minimal markdown-ish renderer for GitHub release notes
export function ReleaseNotes({ notes }: { notes: string }) {
  const lines = (notes || "").split("\n");
  return (
    <div className="space-y-1 text-sm text-[var(--color-muted)]">
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        if (/^#{1,6}\s/.test(line))
          return (
            <div key={i} className="pt-1.5 text-[var(--color-text)] font-semibold">
              <Inline text={line.replace(/^#{1,6}\s/, "")} />
            </div>
          );
        if (/^[-*]\s/.test(line))
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-[var(--color-accent-soft)]">•</span>
              <span><Inline text={line.replace(/^[-*]\s/, "")} /></span>
            </div>
          );
        return <div key={i}><Inline text={line} /></div>;
      })}
    </div>
  );
}

export function UpdateModal() {
  const { releases, currentVersion, updateDismissed } = useStore();
  const dismiss = useStore((s) => s.dismissUpdate);
  const install = useStore((s) => s.installUpdate);
  const [state, setState] = useState<"idle" | "downloading" | "done" | "error">("idle");

  const latest = releases[0];
  const available = !!latest && !!currentVersion && isNewer(latest.tag, currentVersion);
  if (!available || updateDismissed) return null;

  const update = async () => {
    if (!latest.exe_url) {
      open(latest.html_url).catch(() => {});
      return;
    }
    setState("downloading");
    try {
      await install(latest.exe_url);
      setState("done");
    } catch {
      setState("error");
      open(latest.html_url).catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 backdrop-blur-sm">
      <div className="fade-in w-[min(480px,92vw)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-accent)] text-white shadow-[0_8px_24px_-8px_var(--color-accent)]">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="text-base font-semibold">Update available</div>
              <div className="text-xs text-[var(--color-muted)]">
                {currentVersion} → <b className="text-[var(--color-accent-soft)]">{latest.tag.replace(/^v/, "")}</b>
              </div>
            </div>
          </div>
          <button onClick={dismiss} className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]">
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 max-h-64 overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3">
          <ReleaseNotes notes={latest.notes} />
        </div>

        <div className="mt-4 flex items-center gap-2">
          {state === "done" ? (
            <div className="flex flex-1 items-center gap-2 text-sm text-[var(--color-good)]">
              <CheckCircle2 size={16} /> Installer launched — follow its prompts to finish.
            </div>
          ) : (
            <Button variant="primary" className="flex-1 py-2.5" onClick={update} disabled={state === "downloading"}>
              {state === "downloading" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {state === "downloading" ? "Downloading…" : "Update now"}
            </Button>
          )}
          <Button variant="ghost" onClick={() => open(latest.html_url).catch(() => {})}>
            <ExternalLink size={14} /> GitHub
          </Button>
          <Button variant="ghost" onClick={dismiss}>Later</Button>
        </div>
      </div>
    </div>
  );
}
