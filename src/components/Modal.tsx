import { useEffect, useMemo, useRef, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cx } from "@/lib/format";

export type ModalOrigin = { x: number; y: number };

export function originFromEl(el: Element): ModalOrigin {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function originFromEvent(e: { currentTarget: EventTarget }): ModalOrigin {
  return originFromEl(e.currentTarget as Element);
}

function offsetFrom(origin: ModalOrigin | null) {
  if (!origin || typeof window === "undefined") return { x: 0, y: 14 };
  return { x: origin.x - window.innerWidth / 2, y: origin.y - window.innerHeight / 2 };
}

export function Modal({
  open,
  onClose,
  children,
  wide,
  origin,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  origin?: ModalOrigin | null;
}) {
  const reduce = useReducedMotion();
  const last = useRef<ModalOrigin | null>(null);
  if (origin) last.current = origin;
  const from = offsetFrom(origin ?? last.current);
  const grown = Boolean(origin ?? last.current);

  const dialogMotion = useMemo(() => {
    if (reduce) {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1, x: 0, y: 0, scale: 1 },
        exit: { opacity: 0 },
      };
    }
    if (grown) {
      return {
        initial: { opacity: 0, x: from.x, y: from.y, scale: 0.28 },
        animate: { opacity: 1, x: 0, y: 0, scale: 1 },
        exit: { opacity: 0, x: from.x, y: from.y, scale: 0.32 },
      };
    }
    return {
      initial: { opacity: 0, y: 14, scale: 0.96 },
      animate: { opacity: 1, x: 0, y: 0, scale: 1 },
      exit: { opacity: 0, y: 8, scale: 0.97 },
    };
  }, [from.x, from.y, grown, reduce]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="app-modal"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.12 : 0.2, ease: [0.22, 1, 0.36, 1] }}
          onMouseDown={onClose}
        >
          <motion.div
            className={cx("app-modal__dialog", wide && "app-modal__dialog--wide")}
            role="dialog"
            aria-modal="true"
            initial={dialogMotion.initial}
            animate={dialogMotion.animate}
            exit={dialogMotion.exit}
            transition={
              reduce
                ? { duration: 0.12 }
                : grown
                  ? { type: "spring", stiffness: 420, damping: 34, mass: 0.86 }
                  : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
            }
            onMouseDown={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
