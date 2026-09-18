import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cx } from "@/lib/format";

export function HScroll({
  children,
  className,
  viewClass,
}: {
  children: ReactNode;
  className?: string;
  viewClass?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);
  const [grab, setGrab] = useState(false);

  function measure() {
    const el = scroller.current;
    if (!el) return;
    const extra = el.scrollWidth - el.clientWidth;
    if (extra <= 2) {
      setBar(null);
      return;
    }
    const width = Math.max(14, (el.clientWidth / el.scrollWidth) * 100);
    const left = (el.scrollLeft / extra) * (100 - width);
    setBar({ left, width });
  }

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      if (!el || el.scrollWidth <= el.clientWidth + 2) return;
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!delta) return;
      e.preventDefault();
      el.scrollLeft += delta;
    }

    function onMove(e: globalThis.PointerEvent) {
      const d = drag.current;
      if (!d || !el) return;
      const extra = el.scrollWidth - el.clientWidth;
      const trackW = track.current?.clientWidth ?? 1;
      const thumbW = Math.max(16, (el.clientWidth / el.scrollWidth) * trackW);
      const travel = Math.max(1, trackW - thumbW);
      el.scrollLeft = d.left + ((e.clientX - d.x) / travel) * extra;
    }

    function onUp() {
      drag.current = null;
      setGrab(false);
    }

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("resize", measure);
    measure();

    return () => {
      ro.disconnect();
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", measure);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", measure);
    };
  }, []);

  function startDrag(e: ReactPointerEvent<HTMLElement>) {
    const el = scroller.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    drag.current = { x: e.clientX, left: el.scrollLeft };
    setGrab(true);
  }

  function jump(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest(".hscroll__thumb")) return;
    const el = scroller.current;
    const tr = track.current;
    if (!el || !tr) return;
    const rect = tr.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / Math.max(1, rect.width);
    el.scrollLeft = ratio * (el.scrollWidth - el.clientWidth);
  }

  return (
    <div className={cx("hscroll", bar && "has-bar", grab && "is-drag", className)}>
      <div ref={scroller} className={cx("hscroll__view", viewClass)}>
        {children}
      </div>
      {bar ? (
        <div ref={track} className="hscroll__track" onPointerDown={jump}>
          <i
            className="hscroll__thumb"
            style={{ width: `${bar.width}%`, left: `${bar.left}%` }}
            onPointerDown={startDrag}
          />
        </div>
      ) : null}
    </div>
  );
}
