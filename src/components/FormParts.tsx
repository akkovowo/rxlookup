import { type InputHTMLAttributes, type ReactNode } from "react";

export function FormGroup({
  label,
  htmlFor,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: string;
  children: ReactNode;
}) {
  return (
    <div className="form-group">
      <label htmlFor={htmlFor}>
        {label}
        {optional ? <span className="ssndob-label-optional"> {optional}</span> : null}
      </label>
      {children}
    </div>
  );
}

export function InputWrap({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="input-wrap">
      <span className="input-icon" aria-hidden="true">
        {icon}
      </span>
      {children}
    </div>
  );
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={className} {...props} />;
}

export function LoadingOverlay({
  active,
  title,
  sub,
}: {
  active: boolean;
  title: string;
  sub?: string;
}) {
  return (
    <div className={`panel-loading${active ? " active" : ""}`} aria-hidden={!active}>
      <div className="panel-loading__box">
        <div className="panel-loading__spinner" aria-hidden="true" />
        <p className="panel-loading__title">{title}</p>
        {sub ? <p className="panel-loading__sub">{sub}</p> : null}
      </div>
    </div>
  );
}

export const IconUser = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21a8 8 0 1 0-16 0" />
    <circle cx="12" cy="8" r="4" />
  </svg>
);

export const IconUsers = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const IconCalendar = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4" />
    <path d="M8 2v4" />
    <path d="M3 10h18" />
  </svg>
);

export const IconShield = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const IconCity = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18" />
    <path d="M9 8h1" />
    <path d="M9 12h1" />
    <path d="M9 16h1" />
    <path d="M14 8h1" />
    <path d="M14 12h1" />
    <path d="M14 16h1" />
    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
  </svg>
);

export const IconPin = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s6-5.33 6-10a6 6 0 1 0-12 0c0 4.67 6 10 6 10z" />
    <circle cx="12" cy="11" r="2.5" />
  </svg>
);

export const IconZip = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9h16" />
    <path d="M4 15h16" />
    <path d="M10 3 8 21" />
    <path d="M16 3l-2 18" />
  </svg>
);

export const IconPhone = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

export const IconHome = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
    <path d="M3 9l9-6 9 6" />
  </svg>
);

export const IconWallet = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18" />
    <circle cx="16" cy="14" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const IconInfo = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 10v4" />
    <path d="M12 8h.01" />
  </svg>
);

export const IconSearch = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 21l-4.3-4.3" />
    <circle cx="11" cy="11" r="7" />
  </svg>
);
