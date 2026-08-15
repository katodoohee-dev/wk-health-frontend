import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("wk-theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = stored ? stored === "dark" : prefers;
    setDark(next);
    applyTheme(next);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    applyTheme(next);
    window.localStorage.setItem("wk-theme", next ? "dark" : "light");
  };

  return (
    <button type="button" onClick={toggle} aria-label={dark ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"} className="press glass grid size-11 place-items-center rounded-2xl text-foreground shadow-soft">
      <span className="relative block size-5">
        <Sun className={`absolute inset-0 size-5 transition-all duration-300 ${dark ? "scale-50 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"}`} />
        <Moon className={`absolute inset-0 size-5 transition-all duration-300 ${dark ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0"}`} />
      </span>
    </button>
  );
}
