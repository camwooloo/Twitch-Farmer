import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Loader2 } from "lucide-react";
import { TextInput } from "./ui";

interface Props<T> {
  placeholder: string;
  search: (q: string) => Promise<T[]>;
  getLabel: (item: T) => string;
  getSublabel?: (item: T) => string | undefined;
  getImage?: (item: T) => string | undefined;
  onSelect: (item: T) => void;
  icon?: React.ReactNode;
  rounded?: boolean; // round thumbnails (channels) vs box-art (games)
}

export function Autocomplete<T>({
  placeholder,
  search,
  getLabel,
  getSublabel,
  getImage,
  onSelect,
  icon,
  rounded,
}: Props<T>) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await search(term);
      if (id !== seq.current) return;
      setItems(res);
      setOpen(true);
      setActive(0);
      setLoading(false);
    }, 220);
    return () => clearTimeout(t);
  }, [q, search]);

  useLayoutEffect(() => {
    if (open && inputRef.current) setRect(inputRef.current.getBoundingClientRect());
  }, [open, items]);

  useEffect(() => {
    if (!open) return;
    const update = () => inputRef.current && setRect(inputRef.current.getBoundingClientRect());
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const choose = (item: T) => {
    onSelect(item);
    setQ("");
    setItems([]);
    setOpen(false);
  };

  const dropdown =
    open && items.length > 0 && rect
      ? createPortal(
          <div
            style={{
              position: "fixed",
              left: rect.left,
              top: rect.bottom + 6,
              width: rect.width,
              zIndex: 9999,
            }}
            className="max-h-72 overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1 shadow-2xl"
          >
            {items.map((item, i) => {
              const img = getImage?.(item);
              return (
                <button
                  key={getLabel(item) + i}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => { e.preventDefault(); choose(item); }}
                  className={
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition " +
                    (i === active ? "bg-[var(--color-accent)]/20" : "")
                  }
                >
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      className={
                        "h-9 w-9 shrink-0 object-cover " + (rounded ? "rounded-full" : "rounded-md")
                      }
                    />
                  ) : (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--color-surface)] text-[var(--color-muted)]">
                      {icon ?? <Search size={15} />}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[var(--color-text)]">{getLabel(item)}</span>
                    {getSublabel?.(item) && (
                      <span className="block truncate text-[11px] text-[var(--color-muted)]">
                        {getSublabel(item)}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[var(--color-muted)]">
        {loading ? <Loader2 size={15} className="animate-spin" /> : icon ?? <Search size={15} />}
      </span>
      <TextInput
        ref={inputRef}
        value={q}
        placeholder={placeholder}
        className="pl-9"
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && items[active]) { e.preventDefault(); choose(items[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {dropdown}
    </div>
  );
}
