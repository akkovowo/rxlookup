import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "@/lib/format";
import { parseAvatar } from "@/lib/avatars";

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "ghost" | "quiet" | "danger";
  size?: "md" | "sm" | "icon";
  loading?: boolean;
};

export function Button({
  variant = "solid",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: BtnProps) {
  return (
    <button
      className={cx(
        "btn",
        variant === "ghost" && "btn_ghost",
        variant === "quiet" && "btn_quiet",
        variant === "danger" && "btn_danger",
        size === "sm" && "btn_sm",
        size === "icon" && "btn_icon",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <i className="btn__spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} />;
}

export function Select({
  className,
  ...props
}: InputHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx("select", className)} {...props} />;
}

export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={cx("toggle", on && "toggle_on")}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    >
      <i />
    </button>
  );
}

export function Avatar({
  initials,
  mark,
  online,
  size = "md",
  className,
}: {
  initials: string;
  mark?: string | null;
  online?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const parsed = parseAvatar(mark);
  return (
    <span
      className={cx(
        "avatar",
        size === "sm" && "avatar_sm",
        size === "lg" && "avatar_lg",
        size === "xl" && "avatar_xl",
        parsed.kind === "preset" && `avatar--${parsed.id}`,
        parsed.kind === "photo" && "avatar--photo",
        className,
      )}
    >
      {parsed.kind === "photo" ? <img src={parsed.src} alt="" /> : <em>{initials}</em>}
      {online ? <span className="avatar__dot" /> : null}
    </span>
  );
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

export function Skeleton({ style, className }: { style?: CSSProperties; className?: string }) {
  return <span className={cx("skeleton", className)} style={style} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="skel-table" aria-hidden="true">
      <div className="skel-table__head">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} style={{ height: 10, flex: i === 0 ? 1.35 : 1 }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div className="skel-table__row" key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} style={{ height: 12, flex: c === 0 ? 1.35 : 1, opacity: 0.85 - r * 0.08 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="skel-card" aria-hidden="true">
      <div className="skel-card__row">
        <Skeleton style={{ height: 18, width: 140 }} />
        <Skeleton style={{ height: 18, width: 72 }} />
      </div>
      <div className="skel-card__grid">
        <Skeleton style={{ height: 38 }} />
        <Skeleton style={{ height: 38 }} />
        <Skeleton style={{ height: 38 }} />
        <Skeleton style={{ height: 38 }} />
      </div>
      <Skeleton style={{ height: 52 }} />
      <Skeleton style={{ height: 52 }} />
    </div>
  );
}
