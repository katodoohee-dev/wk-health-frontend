import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("wk-theme");
    const next = stored === "dark";
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
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "เปลี่ยนเป็นพื้นหลังสีขาว" : "เปลี่ยนเป็นพื้นหลังสีดำ"}
      title={dark ? "White" : "Black"}
      className="press grid size-11 place-items-center rounded-2xl border border-foreground bg-background text-foreground shadow-none"
    >
      {dark ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
    </button>
  );
}
