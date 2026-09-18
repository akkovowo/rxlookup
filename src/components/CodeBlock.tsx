import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { copyText } from "@/lib/copy";
import { cx } from "@/lib/format";
import { useApp } from "@/lib/store";

const LANGS = [
  { id: "curl", label: "cURL" },
  { id: "js", label: "JavaScript" },
  { id: "python", label: "Python" },
] as const;

export function CodeBlock({
  code,
  label,
}: {
  code: string;
  label?: string;
}) {
  const app = useApp();
  const [copied, setCopied] = useState(false);

  async function copy() {
    const ok = await copyText(code);
    if (!ok) {
      app.showToast("Could not copy");
      return;
    }
    setCopied(true);
    app.showToast("Copied", "copy");
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="docs-code">
      <div className="docs-code__bar">
        <span>{label ?? "Example"}</span>
        <button type="button" className="docs-code__copy" onClick={copy} aria-label="Copy">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function ExampleTabs({
  curl,
  js,
  python,
}: {
  curl: string;
  js: string;
  python: string;
}) {
  const [lang, setLang] = useState<(typeof LANGS)[number]["id"]>("curl");
  const map = { curl, js, python };

  return (
    <div className="docs-ex">
      <div className="docs-ex__tabs" role="tablist" aria-label="Language">
        {LANGS.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={lang === l.id}
            className={cx("docs-ex__tab", lang === l.id && "is-on")}
            onClick={() => setLang(l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="docs-ex__panel">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={lang}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <CodeBlock code={map[lang]} label={LANGS.find((l) => l.id === lang)?.label} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
