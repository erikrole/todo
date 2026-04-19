"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { UpshootSidebar } from "./sidebar";
import { CommandBar } from "./command-bar";
import { ContextRail } from "./context-rail";
import { CommandPalette } from "@/components/command-palette";
import { SelectionProvider } from "@/hooks/use-selection";
import "./tokens.css";

const ACCENT_KEY = "upshot-accent";
const THEME_KEY = "upshot-theme";

export type Accent = "ochre" | "clay" | "sage" | "slate" | "plum";
export type Theme = "light" | "dark";

interface UpshootShellProps {
  children: React.ReactNode;
  fontClassName?: string;
}

function deriveMode(): "morning" | "day" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 21) return "day";
  return "evening";
}

export function UpshootShell({ children, fontClassName }: UpshootShellProps) {
  const pathname = usePathname();
  const showRail = pathname === "/today";
  const [accent, setAccent] = useState<Accent>("ochre");
  const [theme, setTheme] = useState<Theme>("light");
  const mode = deriveMode();

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
      className={`upshot-root ${fontClassName ?? ""}`}
      data-accent={accent}
      data-theme={theme}
      data-mode={mode}
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
      <SelectionProvider>
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
      <CommandPalette />
      <CommandBar />
      </SelectionProvider>
    </div>
  );
}
