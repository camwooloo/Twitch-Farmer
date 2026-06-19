import { AlertTriangle } from "lucide-react";
import { useStore } from "../lib/store";
import { Card } from "./ui";

export function SpadeBanner() {
  const blocked = useStore((s) => s.spadeBlocked);
  if (!blocked) return null;
  return (
    <Card className="border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--color-warn)]" />
        <div className="text-xs">
          <div className="text-sm font-semibold text-[var(--color-text)]">
            Watch-time points aren't being credited
          </div>
          <p className="mt-1 text-[var(--color-muted)]">
            Twitch's watch-time tracker <code className="text-[var(--color-text)]">spade.twitch.tv</code>{" "}
            can't be reached — it's almost certainly blocked by a DNS-level ad/tracker blocker
            (Pi-hole, AdGuard, NextDNS, or a HOSTS entry). Everything else still works, but
            watch-time points won't accrue until you <b className="text-[var(--color-text)]">whitelist
            spade.twitch.tv</b> in your blocker. Predictions, drops and bonus claims are unaffected.
          </p>
        </div>
      </div>
    </Card>
  );
}
