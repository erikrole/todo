"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toLocalDateStr } from "@/lib/dates";
import type { Task } from "@todo/shared";

interface Props {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (notes?: string, completedAt?: string) => void;
}

export function LogCompletionPopover({ task, open, onOpenChange, onComplete }: Props) {
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [calOpen, setCalOpen] = useState(false);

  function handleSubmit(skipNotes = false) {
    const completedAt = toLocalDateStr(date) + "T" + new Date().toTimeString().slice(0, 8);
    onComplete(skipNotes ? undefined : notes.trim() || undefined, completedAt);
    setNotes("");
    setDate(new Date());
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      setNotes("");
      setDate(new Date());
    }
    onOpenChange(v);
  }

  const isToday = toLocalDateStr(date) === toLocalDateStr(new Date());

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm gap-4">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold leading-snug">{task.title}</DialogTitle>
        </DialogHeader>

        {/* Date picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">When did you do this?</label>
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm rounded-md border bg-background hover:bg-accent/40 transition-colors text-left w-full",
                  !isToday && "border-primary/30",
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className={isToday ? "text-muted-foreground" : "text-foreground"}>
                  {isToday
                    ? "Today"
                    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => { if (d) { setDate(d); setCalOpen(false); } }}
                disabled={(d) => d > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Notes <span className="font-normal">(optional)</span></label>
          <Textarea
            className="text-sm resize-none h-20"
            placeholder="e.g. Used 3M filter, brand X oil…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
            autoFocus
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => handleSubmit(true)}>
            Skip note
          </Button>
          <Button size="sm" className="flex-1" onClick={() => handleSubmit()}>
            Log it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
