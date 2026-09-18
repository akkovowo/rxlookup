import { Link } from "react-router-dom";
import { cx } from "@/lib/format";

export function Logo({ large }: { large?: boolean }) {
  return (
    <Link to="/" className={cx("logo", large && "logo_lg")} aria-label="RX Lookup">
      <em>rx</em>
      <span>Lookup</span>
    </Link>
  );
}
