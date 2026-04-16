"use client";

import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAccentColor } from "@/hooks/use-accent-color";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark",  label: "Dark"  },
  { value: "system", label: "System" },
] as const;

export function SettingsSheet() {
  const { accent, setAccent, presets } = useAccentColor();
  const { theme, setTheme } = useTheme();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Settings">
          <Settings className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/60">
            <SheetTitle className="text-sm font-semibold">Appearance</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Accent color */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60 mb-3">
                Accent Color
              </p>
              <div className="flex flex-wrap gap-3">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setAccent(preset.id)}
                    className="flex flex-col items-center gap-1.5 focus:outline-none"
                    aria-label={`Set accent to ${preset.label}`}
                    aria-pressed={accent === preset.id}
                  >
                    <span
                      className={cn(
                        "h-6 w-6 rounded-full block transition-all duration-150",
                        accent === preset.id
                          ? "ring-2 ring-offset-2 ring-offset-background scale-110"
                          : "opacity-60 hover:opacity-90 hover:scale-105",
                      )}
                      style={{
                        backgroundColor: preset.swatch,
                        ...(accent === preset.id ? { "--tw-ring-color": preset.swatch } as React.CSSProperties : {}),
                      }}
                    />
                    <span className={cn(
                      "text-[10px] transition-colors",
                      accent === preset.id ? "text-foreground font-medium" : "text-muted-foreground/60",
                    )}>
                      {preset.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60 mb-3">
                Theme
              </p>
              <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
                {THEME_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      "flex-1 text-[11px] py-1 rounded-md transition-all duration-150 font-medium",
                      theme === value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground/70",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
