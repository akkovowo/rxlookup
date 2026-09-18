import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, ImagePlus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Avatar } from "@/components/ui";
import { AVATAR_PRESETS, cropAvatarFile, parseAvatar } from "@/lib/avatars";
import { cx, initials } from "@/lib/format";
import { useApp } from "@/lib/store";
import { ApiError } from "@/lib/api";

const ease = [0.22, 1, 0.36, 1] as const;

export function AvatarStudio({ size = "lg" }: { size?: "md" | "lg" }) {
  const app = useApp();
  const nick = app.user?.login ?? "";
  const letters = initials(nick) || "?";
  const current = app.user?.avatar ?? "";
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(current);
  const [busy, setBusy] = useState(false);

  function start() {
    setDraft(current);
    setOpen(true);
  }

  async function onFile(file?: File | null) {
    if (!file) return;
    try {
      const data = await cropAvatarFile(file);
      setDraft(data);
    } catch (err) {
      app.showToast(err instanceof Error ? err.message : "Could not read image");
    }
  }

  async function save() {
    setBusy(true);
    try {
      await app.setAvatar(draft);
      setOpen(false);
    } catch (err) {
      app.showToast(err instanceof ApiError ? err.message : "Could not save avatar");
    } finally {
      setBusy(false);
    }
  }

  const parsed = parseAvatar(draft);

  return (
    <>
      <button type="button" className="avatar-edit" onClick={start} aria-label="Change avatar">
        <Avatar initials={letters} mark={current} size={size} />
        <span className="avatar-edit__veil">
          <Camera size={size === "lg" ? 16 : 13} />
        </span>
      </button>

      <Modal open={open} onClose={() => !busy && setOpen(false)} wide>
        <div className="avatar-studio">
          <div className="avatar-studio__stage">
            <span className="avatar-studio__glow" aria-hidden="true" />
            <AnimatePresence mode="wait">
              <motion.span
                key={draft || "none"}
                className="avatar-studio__frame"
                initial={{ opacity: 0, scale: 0.72, rotate: -12, filter: "blur(10px)" }}
                animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.86, rotate: 8, filter: "blur(8px)" }}
                transition={{ duration: 0.42, ease }}
              >
                <Avatar initials={letters} mark={draft} size="xl" />
              </motion.span>
            </AnimatePresence>
            <motion.i
              className="avatar-studio__ring"
              animate={{ rotate: 360 }}
              transition={{ duration: 18, ease: "linear", repeat: Infinity }}
              aria-hidden="true"
            />
          </div>

          <h3>Avatar</h3>
          <p className="panel-card__desc">A mark for the desk. Pick a field, or drop a photo.</p>

          <div className="avatar-studio__grid" role="listbox" aria-label="Marks">
            {AVATAR_PRESETS.map((preset, i) => {
              const value = `preset:${preset.id}`;
              const on = parsed.kind === "preset" && parsed.id === preset.id;
              return (
                <motion.button
                  key={preset.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={cx("avatar-chip", on && "is-on")}
                  initial={{ opacity: 0, y: 10, scale: 0.86 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.34, delay: 0.04 + i * 0.028, ease }}
                  onClick={() => setDraft(value)}
                >
                  <Avatar initials={letters} mark={value} />
                  <span>{preset.label}</span>
                </motion.button>
              );
            })}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.currentTarget.value = "";
            }}
          />

          <div className="avatar-studio__bar">
            <button type="button" className="panel-btn panel-btn--ghost" onClick={() => fileRef.current?.click()}>
              <ImagePlus size={15} />
              Photo
            </button>
            <button
              type="button"
              className="panel-btn panel-btn--ghost"
              onClick={() => setDraft("")}
              disabled={!draft}
            >
              Reset
            </button>
          </div>

          <div className="set-wipe__actions">
            <button type="button" className="panel-btn panel-btn--ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="panel-btn panel-btn--primary" onClick={() => void save()} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
