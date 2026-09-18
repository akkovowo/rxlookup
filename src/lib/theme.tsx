import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const KEY = "theme";

type Theme = "dark" | "light";

type ThemeCtx = {
  theme: Theme;
  toggle: () => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  root.style.backgroundColor = theme === "light" ? "#f3f0ea" : "#070707";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      localStorage.setItem(KEY, next);
      document.documentElement.classList.add("theme-switching");
      applyTheme(next);
      window.setTimeout(() => {
        document.documentElement.classList.remove("theme-switching");
      }, 650);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme outside ThemeProvider");
  return ctx;
}
