"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { UpshootSidebar } from "./sidebar";
import { CommandBar } from "./command-bar";
import { ContextRail } from "./context-rail";
import "./tokens.css";

const ACCENT_KEY = "upshot-accent";
const THEME_KEY = "upshot-theme";

export type Accent = "ochre" | "clay" | "sage" | "slate" | "plum";
export type Theme = "light" | "dark";

interface UpshootShellProps {
  children: React.ReactNode;
  newsreaderClassName?: string;
}

export function UpshootShell({ children, newsreaderClassName }: UpshootShellProps) {
  const pathname = usePathname();
  const showRail = pathname === "/v2/today";
  const [accent, setAccent] = useState<Accent>("ochre");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const a = localStorage.getItem(ACCENT_KEY) as Accent | null;
    const t = localStorage.getItem(THEME_KEY) as Theme | null;
    if (a) setAccent(a);
    if (t) setTheme(t);
  }, []);

  function changeAccent(a: Accent) {
    setAccent(a);
    localStorage.setItem(ACCENT_KEY, a);
  }

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }

  return (
    <div
      className={`upshot-root ${newsreaderClassName ?? ""}`}
      data-accent={accent}
      data-theme={theme}
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "var(--bg)",
        color: "var(--ink)",
        fontFamily: "var(--font-ui)",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <UpshootSidebar
        accent={accent}
        onAccentChange={changeAccent}
        theme={theme}
        onThemeToggle={toggleTheme}
      />
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          paddingBottom: 80,
        }}
      >
        {children}
      </main>
      {showRail && <ContextRail />}
      <CommandBar />
    </div>
  );
}
