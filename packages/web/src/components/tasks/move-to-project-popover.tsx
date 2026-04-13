// packages/web/src/components/tasks/move-to-project-popover.tsx
"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ProjectWithCounts } from "@todo/shared";

interface MoveToProjectPopoverProps {
  projects: ProjectWithCounts[];
  onMove: (projectId: string) => void;
}

export function MoveToProjectPopover({ projects, onMove }: MoveToProjectPopoverProps) {
  const [open, setOpen] = useState(false);

  if (projects.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="px-2.5 py-1 rounded-md border border-border text-xs text-foreground/70 hover:bg-muted transition-colors">
          Move to…
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="center" side="top">
        <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onMove(p.id);
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors"
            >
              {p.color && (
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.color }}
                />
              )}
              {p.name}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
