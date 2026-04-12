// packages/web/src/app/(views)/settings/shortcuts/page.tsx
"use client";

import { useState } from "react";
import { SHORTCUT_DEFS, ShortcutCategory, ShortcutDef, formatKeyParts } from "@/lib/keyboard/shortcut-config";
import { useKeyboard } from "@/components/keyboard/keyboard-provider";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: "Navigation",
  "task-nav": "Task Navigation",
  "task-actions": "Task Actions",
  app: "App",
};

const CATEGORY_ORDER: ShortcutCategory[] = ["navigation", "task-nav", "task-actions", "app"];

function formatKeyDisplay(key: string): string {
  return formatKeyParts(key).join("");
}

interface ConflictState {
  id: string;
  key: string;
  conflictLabel: string;
  conflictId: string;
}

export default function ShortcutsSettingsPage() {
  const keyboard = useKeyboard();
  const [search, setSearch] = useState("");
  const [localRecordingId, setLocalRecordingId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);

  function handleRecordClick(def: ShortcutDef) {
    // Cancel if already recording this one
    if (localRecordingId === def.id) {
      keyboard.stopRecording();
      setLocalRecordingId(null);
      return;
    }
    setLocalRecordingId(def.id);
    keyboard.startRecording(def.id, (key) => {
      setLocalRecordingId(null);
      if (!key) return; // user pressed Escape

      // Check for conflicts with other enabled shortcuts
      const conflictDef = SHORTCUT_DEFS.find((d) => {
        if (d.id === def.id) return false;
        const override = keyboard.overrides[d.id];
        const currentKey = override?.key ?? d.defaultKey;
        const enabled = override?.enabled ?? true;
        return enabled && currentKey === key;
      });

      if (conflictDef) {
        setConflict({ id: def.id, key, conflictLabel: conflictDef.label, conflictId: conflictDef.id });
      } else {
        keyboard.updateShortcut(def.id, key);
      }
    });
  }

  function resolveConflict(confirm: boolean) {
    if (!conflict) return;
    if (confirm) {
      // Clear the conflicting shortcut's binding
      keyboard.updateShortcut(conflict.conflictId, "");
      keyboard.updateShortcut(conflict.id, conflict.key);
    }
    setConflict(null);
  }

  const lowerSearch = search.toLowerCase();
  const filteredDefs = search.trim()
    ? SHORTCUT_DEFS.filter((d) => d.label.toLowerCase().includes(lowerSearch))
    : SHORTCUT_DEFS;

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat],
    items: filteredDefs.filter((d) => d.category === cat),
  })).filter((g) => g.items.length > 0);

  const rows = grouped.flatMap(({ cat, label, items }) => [
    { type: "heading" as const, cat, label },
    ...items.map((def) => ({ type: "row" as const, def })),
  ]);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Keyboard Shortcuts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Click any shortcut to record a new key. Customizations are saved to your browser.
        </p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search shortcuts…"
          className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          onClick={keyboard.resetAll}
          className="h-9 px-3 text-sm border border-input rounded-md text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
        >
          Reset all
        </button>
      </div>

      {conflict && (
        <div className="mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-sm flex items-center justify-between gap-3">
          <span className="text-amber-700 dark:text-amber-400">
            Already used by <strong>{conflict.conflictLabel}</strong> — save anyway?
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => resolveConflict(true)}
              className="text-xs px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => resolveConflict(false)}
              className="text-xs px-2 py-1 rounded border border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 w-[42%]">Name</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 w-[20%]">Category</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Shortcut</th>
              <th className="text-center text-xs font-medium text-muted-foreground px-4 py-2.5 w-16">On</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.type === "heading") {
                return (
                  <tr key={`heading-${row.cat}`} className="bg-muted/10 border-b border-border">
                    <td
                      colSpan={4}
                      className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50"
                    >
                      {row.label}
                    </td>
                  </tr>
                );
              }

              const { def } = row;
              const override = keyboard.overrides[def.id];
              const key = override?.key ?? def.defaultKey;
              const enabled = override?.enabled ?? true;
              const isRecording = localRecordingId === def.id;

              return (
                <tr
                  key={def.id}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="text-sm text-foreground/80">{def.label}</div>
                    {def.description && (
                      <div className="text-xs text-muted-foreground/50 mt-0.5">{def.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground/60 bg-muted/30">
                      {CATEGORY_LABELS[def.category]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleRecordClick(def)}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border transition-colors",
                        isRecording
                          ? "border-primary bg-primary/10 text-primary animate-pulse"
                          : !key
                          ? "border-dashed border-muted-foreground/30 text-muted-foreground/40 hover:border-primary/50 hover:text-primary/60"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary/60 bg-muted/30",
                      )}
                    >
                      {isRecording ? "Recording…" : key ? formatKeyDisplay(key) : "—"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => keyboard.toggleShortcut(def.id, !enabled)}
                      className={cn(
                        "w-8 h-4 rounded-full transition-colors relative flex-shrink-0",
                        enabled ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                          enabled ? "translate-x-4" : "translate-x-0.5",
                        )}
                      />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
