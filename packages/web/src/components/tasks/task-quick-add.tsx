"use client";

import { useState, useRef } from "react";
import type { Task } from "@todo/shared";
import { useCreateTask } from "@/hooks/use-tasks";
import { parseNaturalDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Loader2, Plus } from "lucide-react";

interface TaskQuickAddProps {
  defaults?: Partial<Pick<Task, "whenDate" | "timeOfDay" | "projectId" | "areaId">>;
}

export function TaskQuickAdd({ defaults }: TaskQuickAddProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const createTask = useCreateTask();

  function handleOpen() {
    setOpen(true);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function submit() {
    const title = value.trim();
    if (!title || createTask.isPending) return;
    setError(null);

    const parsedDate = parseNaturalDate(title);
    try {
      await createTask.mutateAsync({
        title,
        whenDate: parsedDate ?? defaults?.whenDate ?? undefined,
        timeOfDay: defaults?.timeOfDay ?? undefined,
        projectId: defaults?.projectId ?? undefined,
        areaId: defaults?.areaId ?? undefined,
      });
      setValue("");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create task");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setValue("");
      setError(null);
      setOpen(false);
    }
  }

  function handleBlur() {
    if (value.trim()) {
      // Don't close — submit instead so content isn't lost
      submit();
    } else {
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="px-3 py-1 flex flex-col gap-1"
    >
      <div className="flex items-center gap-2">
        {createTask.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
        ) : (
          <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={createTask.isPending}
          placeholder='Task title — try "tomorrow" or "next monday"'
          className={cn(
            "flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60",
            "border-b pb-1 disabled:opacity-50",
            error ? "border-destructive" : "border-border",
          )}
        />
      </div>
      {error && <p className="text-xs text-destructive pl-6">{error}</p>}
    </form>
  );
}
