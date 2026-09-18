export const AVATAR_PRESETS = [
  { id: "ember", label: "Ember" },
  { id: "void", label: "Void" },
  { id: "moss", label: "Moss" },
  { id: "wine", label: "Wine" },
  { id: "ice", label: "Ice" },
  { id: "dusk", label: "Dusk" },
  { id: "rust", label: "Rust" },
  { id: "aurora", label: "Aurora" },
  { id: "gold", label: "Gold" },
  { id: "ink", label: "Ink" },
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]["id"];

export function parseAvatar(raw: string | undefined | null) {
  const value = (raw || "").trim();
  if (value.startsWith("preset:")) {
    return { kind: "preset" as const, id: value.slice(7), src: "" };
  }
  if (value.startsWith("data:image/")) {
    return { kind: "photo" as const, id: "", src: value };
  }
  return { kind: "none" as const, id: "", src: "" };
}

export function cropAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choose an image"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read image"));
        return;
      }
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}
