import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { RichText } from "@/lib/richText";
import { cx } from "@/lib/format";

export function NewsNotice({
  title,
  body,
  ctaLabel = "",
  ctaTo = "",
  preview,
  className,
}: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaTo?: string;
  preview?: boolean;
  className?: string;
}) {
  const label = ctaLabel.trim();
  const href = ctaTo.trim();
  const go = label && href;
  const inner = (
    <>
      {label}
      <ArrowUpRight size={14} />
    </>
  );

  return (
    <div className={cx("notice", preview && "notice--preview", className)}>
      <div className="notice__copy">
        <div className="notice__title">{title || "Untitled"}</div>
        <RichText text={body || "Write the note body."} />
      </div>
      {go ? (
        preview || href.startsWith("#") ? (
          <span className="notice__go">{inner}</span>
        ) : href.startsWith("/") ? (
          <Link to={href} className="notice__go">
            {inner}
          </Link>
        ) : (
          <a href={href} className="notice__go" target="_blank" rel="noreferrer">
            {inner}
          </a>
        )
      ) : null}
    </div>
  );
}
