import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bold, Italic, Link2 } from "lucide-react";
import { cx } from "@/lib/format";

function AppLink({ href, children }: { href: string; children: ReactNode }) {
  if (href.startsWith("/")) return <Link to={href}>{children}</Link>;
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export function safeHref(raw: string) {
  const s = raw.trim();
  if (!s) return "";
  if (s.startsWith("/") && !s.startsWith("//") && !s.includes("://")) return s;
  try {
    const url = new URL(s);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch {
    /* ignore */
  }
  return "";
}

function renderLine(line: string): ReactNode[] {
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|\[([^\]]+)\]\(([^)]+)\)|https?:\/\/[^\s<]+)/g;
  const parts: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(line))) {
    if (match.index > last) parts.push(line.slice(last, match.index));
    const tok = match[0];
    if (tok.startsWith("**")) {
      parts.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("[")) {
      const href = safeHref(match[3] || "");
      parts.push(
        href ? (
          <AppLink key={i++} href={href}>
            {match[2]}
          </AppLink>
        ) : (
          <span key={i++}>{match[2]}</span>
        ),
      );
    } else if (tok.startsWith("*")) {
      parts.push(<em key={i++}>{tok.slice(1, -1)}</em>);
    } else {
      const href = safeHref(tok.replace(/[),.;!?]+$/, ""));
      parts.push(href ? <AppLink key={i++} href={href}>{tok}</AppLink> : tok);
    }
    last = match.index + tok.length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = (text || "").split("\n");
  return (
    <div className={cx("rich-text", className)}>
      {lines.map((line, i) => (
        <p key={i}>{line ? renderLine(line) : <br />}</p>
      ))}
    </div>
  );
}

export function FormatField({
  value,
  onChange,
  rows = 5,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("https://");

  function wrap(before: string, after: string, fallback = "text") {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || fallback;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    window.requestAnimationFrame(() => {
      el?.focus();
      const caret = start + before.length + selected.length + after.length;
      el?.setSelectionRange(caret, caret);
    });
  }

  function applyLink() {
    const href = safeHref(url) || url.trim();
    if (!href) return;
    wrap("[", `](${href})`, "link");
    setLinkOpen(false);
    setUrl("https://");
  }

  return (
    <div className="fmt-field">
      <div className="fmt-bar" role="toolbar" aria-label="Formatting">
        <button type="button" className="fmt-bar__btn" onClick={() => wrap("**", "**")} title="Bold">
          <Bold size={13} />
        </button>
        <button type="button" className="fmt-bar__btn" onClick={() => wrap("*", "*")} title="Italic">
          <Italic size={13} />
        </button>
        <button
          type="button"
          className={cx("fmt-bar__btn", linkOpen && "is-on")}
          onClick={() => setLinkOpen((v) => !v)}
          title="Link"
        >
          <Link2 size={13} />
        </button>
      </div>
      {linkOpen ? (
        <div className="fmt-bar__link">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https:// or /path"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
            }}
          />
          <button type="button" className="panel-btn panel-btn--primary" onClick={applyLink}>
            Insert
          </button>
        </div>
      ) : null}
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
