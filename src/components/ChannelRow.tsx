import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, Radio, ChevronDown, Gift } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { useStore } from "../lib/store";

export function ChannelRow({
  login,
  name,
  image,
  leading,
  trailing,
}: {
  login: string;
  name: string;
  image?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  const loadChannelInfo = useStore((s) => s.loadChannelInfo);
  const ci = useStore((s) => s.channelInfo[login.toLowerCase()]);
  const [openRewards, setOpenRewards] = useState(false);

  useEffect(() => {
    loadChannelInfo(login);
  }, [login, loadChannelInfo]);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]">
      <div className="flex items-center gap-3 p-2.5">
        {leading}
        {image ? (
          <img src={image} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded-full bg-[var(--color-surface)]" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
            {!ci ? (
              <span className="opacity-60">checking…</span>
            ) : ci.live ? (
              <>
                <Radio size={11} className="text-[var(--color-good)]" />
                <span className="text-[var(--color-good)]">Live</span>
                {ci.game && <span>· {ci.game}</span>}
              </>
            ) : (
              <span>offline</span>
            )}
            {ci?.balance != null && <span>· {ci.balance.toLocaleString()} pts</span>}
          </div>
        </div>
        {ci && ci.rewards.length > 0 && (
          <button
            onClick={() => setOpenRewards((o) => !o)}
            title="View channel point rewards"
            className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
          >
            <ChevronDown size={15} className={openRewards ? "rotate-180 transition" : "transition"} />
          </button>
        )}
        <button
          onClick={() => open(`https://twitch.tv/${login}`).catch(() => {})}
          title="Open stream in browser"
          className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
        >
          <ExternalLink size={14} />
        </button>
        {trailing}
      </div>
      {openRewards && ci && (
        <div className="border-t border-[var(--color-border)] p-2.5">
          <div className="mb-1.5 text-[11px] font-medium text-[var(--color-muted)]">
            Channel point rewards
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {ci.rewards.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-[var(--color-bg-soft)] p-1.5 text-xs">
                {r.image ? (
                  <img src={r.image} alt="" className="h-6 w-6 rounded object-cover" />
                ) : (
                  <Gift size={14} className="text-[var(--color-accent-soft)]" />
                )}
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                <span className="shrink-0 font-medium text-[var(--color-warn)]">
                  {r.cost.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
