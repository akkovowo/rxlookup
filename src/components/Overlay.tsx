import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "./ui";

export function Overlay({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={onClose}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <>
      <Overlay open={open} onClose={onClose}>
        <motion.aside
          className="drawer"
          initial={{ x: 40, opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 28, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal
          aria-label={title}
        >
          <div className="drawer__head">
            <h2>{title}</h2>
            <Button variant="quiet" size="icon" aria-label="Close" onClick={onClose}>
              <X size={16} />
            </Button>
          </div>
          <div className="drawer__body">{children}</div>
          {footer}
        </motion.aside>
      </Overlay>
    </>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Overlay open={open} onClose={onClose}>
      <motion.div
        className={wide ? "modal modal_wide" : "modal"}
        initial={{ y: 18, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 10, opacity: 0, scale: 0.985 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-label={title ?? "Dialog"}
      >
        <div className="modal__head">
          {title ? <h2>{title}</h2> : <span />}
          <Button variant="quiet" size="icon" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
        <div className="modal__body">{children}</div>
      </motion.div>
    </Overlay>
  );
}
