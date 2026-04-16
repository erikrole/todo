"use client";

import { useCallback, useEffect, useState } from "react";

export type DensityMode = "comfortable" | "compact";
export const DENSITY_STORAGE_KEY = "todo-density";
export const DEFAULT_DENSITY: DensityMode = "comfortable";

export function useDensity() {
  const [density, setDensityState] = useState<DensityMode>(() => {
    if (typeof window === "undefined") return DEFAULT_DENSITY;
    return (localStorage.getItem(DENSITY_STORAGE_KEY) as DensityMode) ?? DEFAULT_DENSITY;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  const setDensity = useCallback((mode: DensityMode) => {
    setDensityState(mode);
    localStorage.setItem(DENSITY_STORAGE_KEY, mode);
    document.documentElement.setAttribute("data-density", mode);
  }, []);

  return { density, setDensity };
}
