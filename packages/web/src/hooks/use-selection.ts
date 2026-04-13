// packages/web/src/hooks/use-selection.ts
"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface SelectionContextValue {
  selectedIds: Set<string>;
  isActive: boolean;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clear: () => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const pathname = usePathname();

  // Clear selection on route change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [pathname]);

  // Clear selection on Escape (capture phase — fires before keyboard provider's task-close)
  const isActive = selectedIds.size > 0;
  useEffect(() => {
    if (!isActive) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setSelectedIds(new Set());
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [isActive]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return (
    <SelectionContext.Provider value={{ selectedIds, isActive, toggle, selectAll, clear }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used within SelectionProvider");
  return ctx;
}
