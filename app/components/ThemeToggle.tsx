"use client";

import { useEffect, useState } from "react";
import * as m from "motion/react-m";
import { currentTheme, onThemeChange, toggleTheme, type Theme } from "@/lib/theme";

/* Day/night for the document pages. The story HUD carries its own NIGHT
   button; both write through lib/theme so the two can never disagree.

   Mounted state exists because the server cannot know the theme — it lives
   in localStorage — so the first render must match the server's markup or
   React screams about hydration. The control renders inert until mounted,
   at which point it reads the attribute the inline script already set. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(currentTheme());
    setMounted(true);
    return onThemeChange(setTheme);
  }, []);

  const dark = mounted && theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(toggleTheme())}
      className="aura-theme-btn"
      aria-pressed={dark}
      aria-label={dark ? "Switch to day" : "Switch to night"}
      title={dark ? "Day" : "Night"}
      data-cursor={dark ? "Day" : "Night"}
    >
      <m.span
        className="aura-theme-icon"
        initial={false}
        animate={{ rotate: dark ? 180 : 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        aria-hidden
      >
        {dark ? (
          /* sun: the thing you would switch TO */
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" />
          </svg>
        )}
      </m.span>
      <span>{dark ? "Day" : "Night"}</span>
    </button>
  );
}
