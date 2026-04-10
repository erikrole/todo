"use client";

import { useState, useRef } from "react";
import type { Task } from "@todo/shared";
import { useCreateTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { parseTaskInput } from "@/lib/parse-task";
import { formatWhenDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Calendar, Clock, FolderOpen, Hourglass, Loader2, Plus } from "lucide-react";

interface TaskQuickAddProps {
  defaults?: Partial<Pick<Task, "whenDate" | "timeOfDay" | "projectId" | "areaId">>;
}

export function TaskQuickAdd({ defaults }: TaskQuickAddProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const createTask = useCreateTask();
  const { data: projects = [] } = useProjects();

  // Parse on every render — pure function, negligible cost
  const parsed = value.trim() ? parseTaskInput(value, projects) : null;
  const hasChips = parsed && (parsed.whenDate || parsed.timeOfDay || parsed.projectId || parsed.deadline || parsed.isSomeday);

  function handleOpen() {
    setOpen(true);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function submit() {
    const title = parsed?.title || value.trim();
    if (!title || createTask.isPending) return;
    setError(null);

    try {
      await createTask.mutateAsync({
        title,
        whenDate: parsed?.whenDate ?? defaults?.whenDate ?? undefined,
        timeOfDay: parsed?.timeOfDay ?? defaults?.timeOfDay ?? undefined,
        deadline: parsed?.deadline ?? undefined,
        isSomeday: parsed?.isSomeday ?? false,
        projectId: parsed?.projectId ?? defaults?.projectId ?? undefined,
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
      submit();
    } else {
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={handleOpen}
        className="w-full justify-start gap-2 pl-4 pr-3 text-muted-foreground/40 hover:text-muted-foreground hover:bg-transparent font-normal"
      >
        <Plus className="h-4 w-4" />
        New task
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="pl-4 pr-3 py-1.5 flex flex-col gap-1.5"
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
          placeholder='New task — try "tomorrow @morning" or "!! friday"'
          className={cn(
            "flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40",
            "border-b pb-1 disabled:opacity-50",
            error ? "border-destructive" : "border-border",
          )}
        />
      </div>

      {/* Live parse preview chips */}
      {hasChips && (
        <div className="flex flex-wrap gap-1.5 pl-6">
          {parsed.whenDate && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              <Calendar className="h-3 w-3" />
              {formatWhenDate(parsed.whenDate)}
            </span>
          )}
          {parsed.timeOfDay && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium">
              <Clock className="h-3 w-3" />
              {parsed.timeOfDay.charAt(0).toUpperCase() + parsed.timeOfDay.slice(1)}
            </span>
          )}
          {parsed.projectName && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 font-medium">
              <FolderOpen className="h-3 w-3" />
              {parsed.projectName}
            </span>
          )}
          {parsed.deadline && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
              <AlertTriangle className="h-3 w-3" />
              Due {formatWhenDate(parsed.deadline)}
            </span>
          )}
          {parsed.isSomeday && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              <Hourglass className="h-3 w-3" />
              Someday
            </span>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive pl-6">{error}</p>}
    </form>
  );
}
