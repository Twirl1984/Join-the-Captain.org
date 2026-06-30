"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

// Schaltet zwischen Dark- und Light-Skin um (data-theme auf <html>),
// merkt sich die Wahl in localStorage. Default = dunkel.
export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("jtc-theme", next);
    } catch {
      /* localStorage kann blockiert sein — egal, dann ohne Persistenz */
    }
    setTheme(next);
  }

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === "dark" ? "Zu hellem Design wechseln" : "Zu dunklem Design wechseln"}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
    </button>
  );
}
