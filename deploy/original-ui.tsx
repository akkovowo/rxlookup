import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/format";

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
  online,
  size = "md",
}: {
  initials: string;
  online?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className={cx("avatar", size === "sm" && "avatar_sm", size === "lg" && "avatar_lg")}>
      {initials}
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

export function Skeleton({ style }: { style?: React.CSSProperties }) {
  return <span className="skeleton" style={style} />;
}
