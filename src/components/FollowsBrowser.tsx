import { useEffect } from "react";
import { Plus, CheckCircle2, Loader2 } from "lucide-react";
import { useStore } from "../lib/store";
import { ChannelRow } from "./ChannelRow";

export function FollowsBrowser({
  added,
  onAdd,
}: {
  added: Set<string>;
  onAdd: (f: { login: string; name: string; image?: string }) => void;
}) {
  const loadFollows = useStore((s) => s.loadFollows);
  const follows = useStore((s) => s.follows);
  const followsLoaded = useStore((s) => s.followsLoaded);
  const channelInfo = useStore((s) => s.channelInfo);

  useEffect(() => {
    loadFollows();
  }, [loadFollows]);

  if (!followsLoaded) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-xs text-[var(--color-muted)]">
        <Loader2 size={14} className="animate-spin" /> Loading your followed channels…
      </div>
    );
  }
  if (follows.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-[var(--color-muted)]">
        No follows found — sign in to the points miner first so we can read your follow list.
      </p>
    );
  }

  // live first, then by balance desc
  const sorted = [...follows].sort((a, b) => {
    const ia = channelInfo[a.login.toLowerCase()];
    const ib = channelInfo[b.login.toLowerCase()];
    if (!!ib?.live !== !!ia?.live) return ib?.live ? 1 : -1;
    return (ib?.balance ?? 0) - (ia?.balance ?? 0);
  });

  return (
    <div className="space-y-2">
      {sorted.map((f) => {
        const isAdded = added.has(f.login);
        return (
          <ChannelRow
            key={f.login}
            login={f.login}
            name={f.name}
            image={f.image}
            trailing={
              <button
                disabled={isAdded}
                onClick={() => onAdd(f)}
                title={isAdded ? "Already farming" : "Add to farm"}
                className={
                  "grid h-7 w-7 place-items-center rounded-md transition " +
                  (isAdded
                    ? "text-[var(--color-good)]"
                    : "bg-[var(--color-accent)]/15 text-[var(--color-accent-soft)] hover:bg-[var(--color-accent)]/25")
                }
              >
                {isAdded ? <CheckCircle2 size={14} /> : <Plus size={14} />}
              </button>
            }
          />
        );
      })}
    </div>
  );
}
