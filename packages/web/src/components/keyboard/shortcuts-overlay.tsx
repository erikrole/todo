// packages/web/src/components/keyboard/shortcuts-overlay.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Keyboard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SHORTCUT_DEFS, ShortcutCategory, formatKeyParts } from "@/lib/keyboard/shortcut-config";
import { useKeyboard, useShortcutAction } from "@/components/keyboard/keyboard-provider";

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: "Navigate",
  "task-nav": "Task Navigation",
  "task-actions": "Task Actions",
  app: "App",
};

const CATEGORY_ORDER: ShortcutCategory[] = ["navigation", "task-nav", "task-actions", "app"];

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);
  const { overrides } = useKeyboard();

  useShortcutAction("show-shortcuts", () => setOpen((v) => !v));

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat],
    items: SHORTCUT_DEFS.filter(
      (d) => d.category === cat && (overrides[d.id]?.enabled ?? true),
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Keyboard className="h-4 w-4" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 grid grid-cols-2 gap-x-8 gap-y-4 max-h-[60vh] overflow-y-auto">
          {grouped.map(({ cat, label, items }) => (
            <div key={cat} className="flex flex-col">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1.5">
                {label}
              </p>
              {items.map((def) => {
                const key = overrides[def.id]?.key ?? def.defaultKey;
                const parts = formatKeyParts(key);
                return (
                  <div
                    key={def.id}
                    className="flex items-center justify-between py-1 border-b border-border/30 last:border-0"
                  >
                    <span className="text-xs text-muted-foreground">{def.label}</span>
                    <div className="flex items-center gap-0.5 ml-3 flex-shrink-0">
                      {parts.map((p, i) => (
                        <kbd
                          key={i}
                          className="inline-flex items-center justify-center bg-muted/60 border border-border/60 rounded px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground min-w-[1.25rem]"
                        >
                          {p}
                        </kbd>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground/40">
            Bare-key shortcuts fire when focus is not in a text field
          </span>
          <Link
            href="/settings/shortcuts"
            onClick={() => setOpen(false)}
            className="text-[11px] text-primary hover:text-primary/80 transition-colors"
          >
            Edit shortcuts →
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
