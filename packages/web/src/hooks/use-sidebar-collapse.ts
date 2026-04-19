import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "sidebar-area-collapsed";

function loadCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function useSidebarCollapse() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCollapsed(loadCollapsed());
  }, []);

  const toggle = useCallback((areaId: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [areaId]: !prev[areaId] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isCollapsed = useCallback(
    (areaId: string) => collapsed[areaId] ?? false,
    [collapsed],
  );

  return { isCollapsed, toggle };
}
