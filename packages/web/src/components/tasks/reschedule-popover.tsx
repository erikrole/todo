// packages/web/src/components/tasks/reschedule-popover.tsx
"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface ReschedulePopoverProps {
  onReschedule: (whenDate: string) => void;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ReschedulePopover({ onReschedule }: ReschedulePopoverProps) {
  const [open, setOpen] = useState(false);

  function pick(date: Date) {
    onReschedule(toDateStr(date));
    setOpen(false);
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="px-2.5 py-1 rounded-md border border-border text-xs text-foreground/70 hover:bg-muted transition-colors">
          Reschedule
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="center" side="top">
        <div className="flex flex-col gap-0.5 mb-2">
          {[
            { label: "Today", date: today },
            { label: "Tomorrow", date: tomorrow },
            { label: "Next Week", date: nextWeek },
          ].map(({ label, date }) => (
            <button
              key={label}
              onClick={() => pick(date)}
              className="text-left px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="border-t border-border/50 pt-2">
          <Calendar
            mode="single"
            onSelect={(date) => {
              if (date) pick(date);
            }}
            fromDate={today}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
