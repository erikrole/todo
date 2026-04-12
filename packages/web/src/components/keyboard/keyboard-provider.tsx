// packages/web/src/components/keyboard/keyboard-provider.tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  SHORTCUT_DEFS,
  ShortcutOverrides,
  eventToKey,
  loadOverrides,
  matchesKey,
  saveOverrides,
} from "@/lib/keyboard/shortcut-config";

interface KeyboardContextValue {
  overrides: ShortcutOverrides;
  focusedTaskId: string | null;
  setFocusedTaskId: (id: string | null) => void;
  registerTaskList: (ids: string[]) => void;
  registerAction: (id: string, handler: () => void) => void;
  unregisterAction: (id: string) => void;
  recordingId: string | null;
  startRecording: (id: string, onRecorded: (key: string | null) => void) => void;
  stopRecording: () => void;
  updateShortcut: (id: string, key: string) => void;
  toggleShortcut: (id: string, enabled: boolean) => void;
  resetAll: () => void;
}

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

export function useKeyboard(): KeyboardContextValue {
  const ctx = useContext(KeyboardContext);
  if (!ctx) throw new Error("useKeyboard must be used within KeyboardProvider");
  return ctx;
}

export function useFocusedTask() {
  const { focusedTaskId, setFocusedTaskId } = useKeyboard();
  return { focusedTaskId, setFocusedTaskId };
}

/**
 * Register the current page's ordered task IDs for j/k navigation.
 * Uses ids.join(",") as a stable dependency so it re-registers when the list changes.
 */
export function useRegisterTaskList(ids: string[]) {
  const { registerTaskList } = useKeyboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { registerTaskList(ids); }, [ids.join(","), registerTaskList]);
}

/**
 * Register an action handler for a shortcut ID.
 * Uses a ref to avoid stale closures — the latest handler is always called.
 */
export function useShortcutAction(id: string, handler: () => void) {
  const { registerAction, unregisterAction } = useKeyboard();
  const handlerRef = useRef(handler);
  useLayoutEffect(() => { handlerRef.current = handler; });
  useEffect(() => {
    const stable = () => handlerRef.current();
    registerAction(id, stable);
    return () => unregisterAction(id);
  }, [id, registerAction, unregisterAction]);
}

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<ShortcutOverrides>({});
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const pathname = usePathname();

  const orderedTaskIds = useRef<string[]>([]);
  const actionHandlers = useRef<Map<string, () => void>>(new Map());
  const onRecordedCallback = useRef<((key: string | null) => void) | null>(null);

  // Keep mutable refs in sync for use inside the stable keydown listener
  const focusedRef = useRef(focusedTaskId);
  useEffect(() => { focusedRef.current = focusedTaskId; }, [focusedTaskId]);
  const overridesRef = useRef(overrides);
  useEffect(() => { overridesRef.current = overrides; }, [overrides]);
  const recordingRef = useRef(recordingId);
  useEffect(() => { recordingRef.current = recordingId; }, [recordingId]);

  // Load persisted customizations on mount
  useEffect(() => { setOverrides(loadOverrides()); }, []);

  // Reset focus whenever the user navigates to a different view
  useEffect(() => { setFocusedTaskId(null); }, [pathname]);

  const registerTaskList = useCallback((ids: string[]) => {
    orderedTaskIds.current = ids;
  }, []);

  const registerAction = useCallback((id: string, handler: () => void) => {
    actionHandlers.current.set(id, handler);
  }, []);

  const unregisterAction = useCallback((id: string) => {
    actionHandlers.current.delete(id);
  }, []);

  const startRecording = useCallback((id: string, onRecorded: (key: string | null) => void) => {
    setRecordingId(id);
    onRecordedCallback.current = onRecorded;
  }, []);

  const stopRecording = useCallback(() => {
    setRecordingId(null);
    onRecordedCallback.current = null;
  }, []);

  const updateShortcut = useCallback((id: string, key: string) => {
    setOverrides((prev) => {
      const next = { ...prev, [id]: { key, enabled: prev[id]?.enabled ?? true } };
      saveOverrides(next);
      return next;
    });
  }, []);

  const toggleShortcut = useCallback((id: string, enabled: boolean) => {
    setOverrides((prev) => {
      const def = SHORTCUT_DEFS.find((d) => d.id === id);
      const key = prev[id]?.key ?? def?.defaultKey ?? "";
      const next = { ...prev, [id]: { key, enabled } };
      saveOverrides(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setOverrides({});
    saveOverrides({});
  }, []);

  // Single global keydown listener. All state is accessed via refs to keep
  // the effect stable (empty deps array — never re-registers).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Let Radix dialogs/popovers handle their own Escape/etc first
      if (e.defaultPrevented) return;

      // ── Recording mode ────────────────────────────────────────────────
      const rid = recordingRef.current;
      if (rid) {
        const key = eventToKey(e);
        if (!key) return; // lone modifier
        e.preventDefault();
        const result = e.key === "Escape" ? null : key;
        const cb = onRecordedCallback.current;
        onRecordedCallback.current = null;
        setRecordingId(null);
        cb?.(result);
        return;
      }

      // ── Normal shortcut dispatch ───────────────────────────────────────
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const cur = overridesRef.current;

      for (const def of SHORTCUT_DEFS) {
        const override = cur[def.id];
        const key = override?.key ?? def.defaultKey;
        const enabled = override?.enabled ?? true;

        if (!enabled) continue;
        if (!matchesKey(e, key)) continue;

        // Bare keys (no Meta/Ctrl/Alt modifier): skip when focus is in a text field
        const isBareKey = !key.includes("Meta") && !key.includes("Ctrl") && !key.includes("Alt");
        if (isBareKey && inInput) continue;

        // Built-in: task navigation moves the focus cursor
        if (def.id === "task-next") {
          e.preventDefault();
          const ids = orderedTaskIds.current;
          if (!ids.length) break;
          const idx = ids.indexOf(focusedRef.current ?? "");
          setFocusedTaskId(ids[idx === -1 ? 0 : Math.min(idx + 1, ids.length - 1)]);
          break;
        }
        if (def.id === "task-prev") {
          e.preventDefault();
          const ids = orderedTaskIds.current;
          if (!ids.length) break;
          const idx = ids.indexOf(focusedRef.current ?? "");
          if (idx > 0) setFocusedTaskId(ids[idx - 1]);
          break;
        }

        // Dispatch to registered handler
        const handler = actionHandlers.current.get(def.id);
        if (handler) {
          e.preventDefault();
          handler();
        }
        break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []); // stable — everything read through refs

  return (
    <KeyboardContext.Provider
      value={{
        overrides,
        focusedTaskId,
        setFocusedTaskId,
        registerTaskList,
        registerAction,
        unregisterAction,
        recordingId,
        startRecording,
        stopRecording,
        updateShortcut,
        toggleShortcut,
        resetAll,
      }}
    >
      {children}
    </KeyboardContext.Provider>
  );
}
