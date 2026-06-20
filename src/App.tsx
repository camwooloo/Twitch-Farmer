import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Coins,
  Dices,
  Gift,
  ScrollText,
  Settings as SettingsIcon,
  Play,
  Square,
  Sprout,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import clsx from "clsx";
import { useStore } from "./lib/store";
import { LoginModal } from "./components/LoginModal";
import { UpdateModal } from "./components/UpdateModal";
import { Dashboard } from "./pages/Dashboard";
import { Points } from "./pages/Points";
import { Predictions } from "./pages/Predictions";
import { Drops } from "./pages/Drops";
import { Logs } from "./pages/Logs";
import { Settings } from "./pages/Settings";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/points", label: "Points", icon: Coins },
  { to: "/predictions", label: "Predictions", icon: Dices },
  { to: "/drops", label: "Drops", icon: Gift },
  { to: "/logs", label: "Logs", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const points = useStore((s) => s.points);
  const predictions = useStore((s) => s.predictions);
  const drops = useStore((s) => s.drops);

  return (
    <aside
      className={clsx(
        "flex shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-soft)]/60 backdrop-blur transition-all duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={clsx("flex items-center py-5", collapsed ? "justify-center px-0" : "gap-2.5 px-5")}>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-accent)] shadow-[0_8px_24px_-8px_var(--color-accent)]">
          <Sprout size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">Twitch Farmer</div>
            <div className="text-[10px] text-[var(--color-muted)]">points · drops</div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              clsx(
                "flex items-center rounded-lg py-2 text-sm transition",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                isActive
                  ? "bg-[var(--color-accent)]/15 text-[var(--color-text)]"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={isActive ? "text-[var(--color-accent-soft)]" : ""} />
                {!collapsed && label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[var(--color-border)] p-3">
        <FarmControl collapsed={collapsed} />
        {!collapsed && (
          <div className="mt-2.5 flex items-center justify-between gap-1 px-1">
            <EngineDot label="Points" running={points.running} engine="points" />
            <EngineDot label="Bets" running={predictions.running} engine="predictions" />
            <EngineDot label="Drops" running={drops.running} engine="drops" />
          </div>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={clsx(
            "mt-2 flex w-full items-center rounded-lg py-2 text-xs text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]",
            collapsed ? "justify-center px-0" : "gap-2 px-2",
          )}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}

function FarmControl({ collapsed }: { collapsed: boolean }) {
  const points = useStore((s) => s.points);
  const predictions = useStore((s) => s.predictions);
  const drops = useStore((s) => s.drops);
  const control = useStore((s) => s.control);
  const running = points.running || predictions.running || drops.running;
  return (
    <button
      onClick={() => control("all", running ? "stop" : "start")}
      title={running ? "Stop farming" : "Start farming"}
      className={clsx(
        "flex w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition",
        collapsed ? "h-10 px-0" : "px-4 py-2.5",
        running
          ? "bg-[var(--color-bad)]/15 text-[var(--color-bad)] hover:bg-[var(--color-bad)]/25"
          : "bg-[var(--color-accent)] text-white shadow-[0_8px_24px_-8px_var(--color-accent)] hover:bg-[var(--color-accent-soft)]",
      )}
    >
      {running ? <Square size={15} /> : <Play size={15} />}
      {!collapsed && (running ? "Stop farming" : "Start farming")}
    </button>
  );
}

function EngineDot({
  label,
  running,
  engine,
}: {
  label: string;
  running: boolean;
  engine: "points" | "predictions" | "drops";
}) {
  const control = useStore((s) => s.control);
  return (
    <button
      onClick={() => control(engine, running ? "stop" : "start")}
      title={`${label} — click to ${running ? "stop" : "start"} individually`}
      className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
    >
      <span
        className={clsx(
          "h-2 w-2 rounded-full",
          running ? "bg-[var(--color-good)] live-dot" : "bg-[var(--color-muted)]",
        )}
      />
      {label}
    </button>
  );
}

function TopBar() {
  const connected = useStore((s) => s.connected);
  const saving = useStore((s) => s.saving);
  const location = useLocation();
  const title =
    NAV.find((n) =>
      n.end
        ? n.to === location.pathname
        : location.pathname.startsWith(n.to) && n.to !== "/",
    )?.label ?? "Dashboard";
  return (
    <header className="flex items-center justify-between border-b border-[var(--color-border)] px-7 py-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="flex items-center gap-3 text-xs">
        {saving && <span className="text-[var(--color-muted)]">Saving…</span>}
        <span
          className={clsx(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1",
            connected
              ? "bg-[var(--color-good)]/15 text-[var(--color-good)]"
              : "bg-[var(--color-bad)]/15 text-[var(--color-bad)]",
          )}
        >
          <span
            className={clsx(
              "h-1.5 w-1.5 rounded-full",
              connected ? "bg-[var(--color-good)] live-dot" : "bg-[var(--color-bad)]",
            )}
          />
          {connected ? "Engine connected" : "Connecting…"}
        </span>
      </div>
    </header>
  );
}

function Shell() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("tf_sidebar_collapsed") === "1",
  );
  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem("tf_sidebar_collapsed", c ? "0" : "1");
      return !c;
    });
  };
  return (
    <div className="app-bg flex h-screen w-screen overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          <div className="mx-auto max-w-5xl fade-in">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/points" element={<Points />} />
              <Route path="/predictions" element={<Predictions />} />
              <Route path="/drops" element={<Drops />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const init = useStore((s) => s.init);
  const config = useStore((s) => s.config);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (config?.app.accent) {
      document.documentElement.style.setProperty("--color-accent", config.app.accent);
    }
  }, [config?.app.accent]);

  if (!config) {
    return (
      <div className="app-bg grid h-screen w-screen place-items-center">
        <div className="flex flex-col items-center gap-3 text-[var(--color-muted)]">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-accent)] shadow-[0_8px_24px_-8px_var(--color-accent)]">
            <Sprout className="text-white" />
          </div>
          <div className="text-sm">Starting engine…</div>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Shell />
      <LoginModal />
      <UpdateModal />
    </HashRouter>
  );
}
