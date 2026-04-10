"use client";

import { useState, useRef } from "react";
import type { Task } from "@todo/shared";
import { useCreateTask } from "@/hooks/use-tasks";
import { parseNaturalDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

interface TaskQuickAddProps {
  defaults?: Partial<Pick<Task, "whenDate" | "timeOfDay" | "projectId" | "areaId">>;
}

export function TaskQuickAdd({ defaults }: TaskQuickAddProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const createTask = useCreateTask();

  function handleOpen() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const title = value.trim();
    if (!title) return;

    // Extract natural language date from title
    const parsedDate = parseNaturalDate(title);

    await createTask.mutateAsync({
      title,
      whenDate: parsedDate ?? defaults?.whenDate ?? undefined,
      timeOfDay: defaults?.timeOfDay ?? undefined,
      projectId: defaults?.projectId ?? undefined,
      areaId: defaults?.areaId ?? undefined,
    });

    setValue("");
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setValue("");
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <Plus className="h-4 w-4" />
        <span>New task</span>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="px-3 py-1">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (!value.trim()) setOpen(false); }}
        placeholder='Task title — try "tomorrow" or "next monday"'
        className={cn(
          "w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60",
          "border-b border-border pb-1",
        )}
      />
    </form>
  );
}
