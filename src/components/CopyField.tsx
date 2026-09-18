import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyText } from "@/lib/copy";
import { cx } from "@/lib/format";
import { useApp } from "@/lib/store";

export function CopyField({
  value,
  toast = "Copied",
}: {
  value: string;
  toast?: string;
}) {
  const app = useApp();
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    const ok = await copyText(value);
    if (!ok) {
      app.showToast("Could not copy");
      return;
    }
    setCopied(true);
    app.showToast(toast, "copy");
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      className={cx("auth__secret", copied && "is-copied")}
      onClick={() => void onCopy()}
      aria-label={copied ? "Copied" : "Copy"}
    >
      <code>{value}</code>
      <span className="auth__secret-mark" aria-hidden="true">
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </span>
    </button>
  );
}
