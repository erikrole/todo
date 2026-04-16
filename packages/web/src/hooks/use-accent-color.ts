"use client";

import { useCallback, useEffect, useState } from "react";
import { type AccentId, ACCENT_PRESETS, ACCENT_STORAGE_KEY, DEFAULT_ACCENT } from "@/lib/accent-colors";

export function useAccentColor() {
  const [accent, setAccentState] = useState<AccentId>(() => {
    if (typeof window === "undefined") return DEFAULT_ACCENT;
    return (localStorage.getItem(ACCENT_STORAGE_KEY) as AccentId) ?? DEFAULT_ACCENT;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", accent);
  }, [accent]);

  const setAccent = useCallback((id: AccentId) => {
    setAccentState(id);
    localStorage.setItem(ACCENT_STORAGE_KEY, id);
    document.documentElement.setAttribute("data-accent", id);
  }, []);

  return { accent, setAccent, presets: ACCENT_PRESETS };
}
