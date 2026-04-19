"use client";

import { memo, useState, useEffect, useRef, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { Task, Section, Area } from "@todo/shared";
import type { ProjectWithCounts } from "@todo/shared";
import { TaskCheckbox } from "./task-checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { useFocusedTask } from "@/components/keyboard/keyboard-provider";
import { useSelection } from "@/hooks/use-selection";
import { loadSelectionModifier } from "@/lib/keyboard/shortcut-config";
import { deadlineUrgency, fmtTime, formatWhenDate } from "@/lib/dates";
import { parseTaskInput } from "@/lib/parse-task";
import { useCompleteTask, useCreateTask, useDeleteTask, useDuplicateTask, useRestoreTask, useUncompleteTask, useUpdateTask, useTask } from "@/hooks/use-tasks";
import { LogCompletionPopover } from "@/components/routines/log-completion-popover";
import { notify } from "@/lib/toast";
import { toLocalDateStr } from "@/lib/dates";
import { Calendar as CalendarIcon, Check, Clock, Flag, ListTree, Plus, Repeat2, Trash2, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface TaskItemProps {
  task: Task;
  /** Expanded state managed by parent for single-expand semantics */
  isExpanded: boolean;
  /** Receives the task ID so the parent can use a stable useCallback */
  onToggle: (id: string) => void;
  activeProjects: ProjectWithCounts[];
  activeAreas?: Area[];
  activeSections?: Section[];
  showWhenDate?: boolean;
}

function todayStr() {
  return toLocalDateStr(new Date());
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalDateStr(d);
}

function nextWeekStr() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return toLocalDateStr(d);
}

function recurrenceLabel(type: string, interval: number | null | undefined): string {
  const n = interval ?? 1;
  if (n <= 1) return type.charAt(0).toUpperCase() + type.slice(1);
  const plural: Record<string, string> = { daily: "days", weekly: "weeks", monthly: "months", yearly: "years" };
  return `Every ${n} ${plural[type] ?? type}`;
}

function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export const TaskItem = memo(function TaskItem({
  task,
  isExpanded,
  onToggle,
  activeProjects,
  activeAreas = [],
  activeSections = [],
  showWhenDate,
}: TaskItemProps) {
  const completeTask = useCompleteTask();
  const uncompleteTask = useUncompleteTask();
  const deleteTask = useDeleteTask();
  const duplicateTask = useDuplicateTask();
  const restoreTask = useRestoreTask();
  const updateTask = useUpdateTask();
  const { focusedTaskId } = useFocusedTask();
  const isFocused = focusedTaskId === task.id;
  const selection = useSelection();
  const isSelected = selection.selectedIds.has(task.id);

  type MoveFields = { whenDate?: string | null; timeOfDay?: "morning" | "day" | "night" | null; isSomeday?: boolean; projectId?: string | null; areaId?: string | null; sectionId?: string | null };
  function moveTask(patch: MoveFields, label: string) {
    const snapshot: MoveFields = { whenDate: task.whenDate, timeOfDay: task.timeOfDay, isSomeday: task.isSomeday, projectId: task.projectId, areaId: task.areaId, sectionId: task.sectionId };
    updateTask.mutate(
      { id: task.id, ...patch },
      { onSuccess: () => notify.undoable(label, () => updateTask.mutate({ id: task.id, ...snapshot })) },
    );
  }

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const titleRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes ?? "");
  }, [task.id, task.title, task.notes]);

  useEffect(() => {
    if (!isExpanded) return;
    const timer = setTimeout(() => titleRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [isExpanded]);

  // Close on click outside, but not when clicking inside a Radix portal (context menu, popover)
  useEffect(() => {
    if (!isExpanded) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if ((target as Element).closest?.("[data-radix-popper-content-wrapper]")) return;
      onToggle(task.id);
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isExpanded, onToggle, task.id]);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  // Combine dnd ref and containerRef
  const setRefs = useCallback(
    (el: HTMLElement | null) => {
      setNodeRef(el);
      (containerRef as React.MutableRefObject<HTMLElement | null>).current = el;
    },
    [setNodeRef],
  );

  const dragStyle = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const [logPopoverOpen, setLogPopoverOpen] = useState(false);

  function handleComplete() {
    if (task.recurrenceType) {
      setLogPopoverOpen(true);
      return;
    }
    completeTask.mutate({ id: task.id }, {
      onSuccess: () => notify.undoable("Task completed", () => uncompleteTask.mutate(task.id)),
    });
  }

  function handleUncomplete() {
    uncompleteTask.mutate(task.id, {
      onSuccess: () => notify.undoable("Marked incomplete", () => completeTask.mutate({ id: task.id })),
    });
  }

  function save() {
    const trimmed = title.trim();
    if (!trimmed) { setTitle(task.title); return; }

    const parsed = parseTaskInput(trimmed, activeProjects);
    const cleanTitle = parsed.title || trimmed;

    if (cleanTitle === task.title && notes === (task.notes ?? "") && !parsed.whenDate && !parsed.timeOfDay && !parsed.deadline && !parsed.projectId && !parsed.isSomeday) return;

    // Always update title + notes; only apply parsed fields when tokens were found
    const patch: Parameters<typeof updateTask.mutate>[0] = { id: task.id, title: cleanTitle, notes: notes || null };
    if (parsed.whenDate) patch.whenDate = parsed.whenDate;
    if (parsed.timeOfDay) patch.timeOfDay = parsed.timeOfDay;
    if (parsed.deadline) patch.deadline = parsed.deadline;
    if (parsed.projectId) patch.projectId = parsed.projectId;
    if (parsed.isSomeday) patch.isSomeday = parsed.isSomeday;

    if (cleanTitle !== trimmed) setTitle(cleanTitle);
    updateTask.mutate(patch);
  }

  return (
    <>
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setRefs}
          style={{ ...dragStyle, opacity: isDragging ? 0.3 : 1 }}
          className={cn(
            "transition-[border-color,background-color,box-shadow,border-radius] duration-150",
            isExpanded && "rounded-xl border border-border/70 bg-card shadow-sm my-1.5",
          )}
          data-task-id={task.id}
          data-focused={isFocused ? "true" : undefined}
          data-selected={isSelected ? "true" : undefined}
          {...attributes}
          {...listeners}
        >
          {/* Title row */}
          <div
            className={cn(
              "group relative flex items-start gap-3 py-2",
              isExpanded
                ? "px-4 pt-3.5"
                : cn(
                    "pl-4 pr-3 border-l-2",
                    isSelected
                      ? "border-primary/70 bg-primary/[0.07]"
                      : isFocused
                        ? "border-primary/70 bg-primary/[0.04]"
                        : "border-transparent hover:border-primary/40 hover:bg-primary/[0.05]",
                  ),
              isDragging ? "cursor-grabbing" : "cursor-pointer",
            )}
            onClick={(e) => {
              if (isDragging) return;
              const modifier = loadSelectionModifier();
              const modPressed =
                modifier === "meta" ? e.metaKey : modifier === "ctrl" ? e.ctrlKey : e.altKey;
              if (modPressed) {
                e.stopPropagation();
                selection.toggle(task.id);
                return;
              }
              onToggle(task.id);
            }}
          >
            <div
              className="mt-[3px] shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                if (selection.isActive) {
                  selection.toggle(task.id);
                }
              }}
            >
              {selection.isActive ? (
                <button
                  type="button"
                  aria-label={isSelected ? "Deselect task" : "Select task"}
                  className={cn(
                    "h-[18px] w-[18px] rounded-sm border-[1.5px] flex items-center justify-center transition-colors",
                    isSelected
                      ? "bg-primary border-primary"
                      : "border-foreground/20 hover:border-primary/55",
                  )}
                >
                  {isSelected && (
                    <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5">
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              ) : (
                <TaskCheckbox
                  checked={task.isCompleted}
                  onComplete={handleComplete}
                  onUncomplete={handleUncomplete}
                  tint={
                    activeProjects.find((p) => p.id === task.projectId)?.color ??
                    activeAreas.find((a) => a.id === (task.areaId ?? activeProjects.find((p) => p.id === task.projectId)?.areaId))?.color ??
                    undefined
                  }
                  isFlagged={!!task.deadline && !task.isCompleted}
                />
              )}
            </div>

            {isExpanded ? (
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); titleRef.current?.blur(); } }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 bg-transparent text-sm font-semibold outline-none text-foreground"
                placeholder="Task title"
              />
            ) : (
              <div className="flex flex-1 flex-col min-w-0">
                <span
                  className={cn(
                    "text-sm font-semibold leading-snug tracking-[-0.006em]",
                    task.isCompleted
                      ? "text-muted-foreground/65"
                      : task.isCancelled
                        ? "line-through text-muted-foreground/40"
                        : "text-foreground",
                  )}
                >
                  {task.title}
                </span>
                {task.notes?.trim() && !isExpanded && (
                  <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed mt-0.5">
                    {task.notes.split("\n").find((l) => l.trim())}
                  </p>
                )}
                {((showWhenDate && task.whenDate) || task.scheduledTime || task.recurrenceType || task.deadline || task.notes?.trim() || (task.isSomeday && !task.whenDate)) && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {task.isSomeday && !task.whenDate && (
                      <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5 leading-none">
                        Someday
                      </span>
                    )}
                    {showWhenDate && task.whenDate && (
                      <span className={cn(
                        "text-xs tabular-nums",
                        !task.isCompleted && task.whenDate < todayStr()
                          ? "text-destructive/70"
                          : "text-muted-foreground/70",
                      )}>
                        {formatWhenDate(task.whenDate)}
                      </span>
                    )}
                    {task.scheduledTime && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-teal-600/70 dark:text-teal-400/70 tabular-nums">
                        <Clock className="h-2.5 w-2.5" />
                        {fmtTime(task.scheduledTime)}
                      </span>
                    )}
                    {task.recurrenceType && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground/60">
                        <Repeat2 className="h-2.5 w-2.5" />
                        {recurrenceLabel(task.recurrenceType, task.recurrenceInterval)}
                      </span>
                    )}
                    {task.deadline && !task.isCompleted && (
                      <span className={cn(
                        "inline-flex items-center gap-0.5 text-xs tabular-nums",
                        daysUntil(task.deadline) < 0
                          ? "text-destructive/80"
                          : daysUntil(task.deadline) <= 2
                            ? "text-amber-600/80 dark:text-amber-400/80"
                            : "text-muted-foreground/60",
                      )}>
                        <Flag className="h-2.5 w-2.5" />
                        {daysUntil(task.deadline) < 0
                          ? `overdue ${Math.abs(daysUntil(task.deadline))}d`
                          : daysUntil(task.deadline) === 0
                            ? "due today"
                            : `due ${new Date(task.deadline + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                      </span>
                    )}
                    {task.notes?.trim() && (
                      <span className="text-xs text-muted-foreground/60">·</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {!isExpanded && (task.isCompleted ? !!task.completedAt : !!task.deadline) && (
              <div className="ml-auto shrink-0 self-center">
                {task.isCompleted && task.completedAt ? (
                  <span className="text-xs tabular-nums text-muted-foreground/60">
                    {new Date(task.completedAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                ) : task.deadline ? (
                  <DeadlineBadge deadline={task.deadline} />
                ) : null}
              </div>
            )}
          </div>

          {/* Inline expanded panel */}
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
              isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden">
              <ExpandedPanel
                task={task}
                notes={notes}
                setNotes={setNotes}
                onSave={save}
                onDelete={() => deleteTask.mutate(task.id, {
                  onSuccess: () => notify.undoable("Task deleted", () => restoreTask.mutate(task.id)),
                })}
                onClearScheduledTime={() => updateTask.mutate({ id: task.id, scheduledTime: null })}
                onDateChange={(date) => updateTask.mutate({ id: task.id, whenDate: date, isSomeday: false })}
                onDeadlineChange={(date) => updateTask.mutate({ id: task.id, deadline: date })}
                onTimeOfDayChange={(tod) => updateTask.mutate({ id: task.id, timeOfDay: tod })}
                onRecurrenceChange={(r) => updateTask.mutate({ id: task.id, ...r })}
              />
            </div>
          </div>
        </div>
      </ContextMenuTrigger>

          <ContextMenuContent className="w-52">
            <ContextMenuItem onSelect={() => moveTask({ whenDate: todayStr(), timeOfDay: null, isSomeday: false }, "Moved to Today")}>
              Move to Today
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => moveTask({ whenDate: null, timeOfDay: null, isSomeday: false }, "Moved to Inbox")}>
              Move to Inbox
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => moveTask({ whenDate: tomorrowStr(), isSomeday: false }, "Moved to Upcoming")}>
              Move to Upcoming
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => moveTask({ whenDate: nextWeekStr(), isSomeday: false }, "Moved to Next Week")}>
              Move to Next Week
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() =>
                moveTask(
                  { isSomeday: !task.isSomeday, whenDate: null, timeOfDay: null },
                  task.isSomeday ? "Moved out of Someday" : "Moved to Someday",
                )
              }
            >
              {task.isSomeday ? "Move out of Someday" : "Move to Someday"}
            </ContextMenuItem>
            {activeProjects.length > 0 && (
              <ContextMenuSub>
                <ContextMenuSubTrigger>Move to Project</ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  {activeProjects.map((p) => (
                    <ContextMenuItem
                      key={p.id}
                      onSelect={() => moveTask({ projectId: p.id }, `Moved to ${p.name}`)}
                    >
                      <span className="flex items-center gap-2">
                        {p.color && (
                          <span
                            className="h-2 w-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: p.color }}
                          />
                        )}
                        {p.name}
                      </span>
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}
            {activeSections.length > 0 && (
              <ContextMenuSub>
                <ContextMenuSubTrigger>Move to Section</ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuItem onSelect={() => moveTask({ sectionId: null }, "Moved to No Section")}>
                    No Section
                  </ContextMenuItem>
                  {activeSections.map((s) => (
                    <ContextMenuItem
                      key={s.id}
                      onSelect={() => moveTask({ sectionId: s.id }, `Moved to ${s.title}`)}
                    >
                      {s.title}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={task.isCompleted ? handleUncomplete : handleComplete}>
              {task.isCompleted ? "Incomplete" : "Complete"}
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => updateTask.mutate({ id: task.id, isCancelled: !task.isCancelled })}
            >
              {task.isCancelled ? "Uncancel" : "Cancel"}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => duplicateTask.mutate(task.id)}>
              Duplicate
            </ContextMenuItem>
            <ContextMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => deleteTask.mutate(task.id, {
                onSuccess: () => notify.undoable("Task deleted", () => restoreTask.mutate(task.id)),
              })}
            >
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      <LogCompletionPopover
        task={task}
        open={logPopoverOpen}
        onOpenChange={setLogPopoverOpen}
        onComplete={(notes, completedAt) => {
          setLogPopoverOpen(false);
          completeTask.mutate({ id: task.id, notes, completedAt }, {
            onSuccess: () => notify.undoable("Routine logged", () => uncompleteTask.mutate(task.id)),
          });
        }}
      />
    </>
  );
});

// Separate component so useTask / useCreateTask only fire when a task is expanded
const TIME_OF_DAY_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "day", label: "Day" },
  { value: "night", label: "Evening" },
] as const;

type TimeOfDay = "morning" | "day" | "night";

type RecurrenceType = "daily" | "weekly" | "monthly" | "yearly";
type RecurrenceMode = "on_schedule" | "after_completion";
interface RecurrencePatch {
  recurrenceType: RecurrenceType | null;
  recurrenceMode?: RecurrenceMode | null;
  recurrenceInterval?: number | null;
}

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function ExpandedPanel({
  task,
  notes,
  setNotes,
  onSave,
  onDelete,
  onClearScheduledTime,
  onDateChange,
  onDeadlineChange,
  onTimeOfDayChange,
  onRecurrenceChange,
}: {
  task: Task;
  notes: string;
  setNotes: (v: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onClearScheduledTime: () => void;
  onDateChange: (date: string | null) => void;
  onDeadlineChange: (date: string | null) => void;
  onTimeOfDayChange: (tod: TimeOfDay | null) => void;
  onRecurrenceChange: (r: RecurrencePatch) => void;
}) {
  const { data: fullTask } = useTask(task.id);
  const createTask = useCreateTask();
  const completeSubtask = useCompleteTask();
  const subtasks = fullTask?.subtasks ?? [];
  const completedSubtasks = subtasks.filter((s) => s.isCompleted).length;
  const deadlineDays = task.deadline ? daysUntil(task.deadline) : null;
  const urgency = task.deadline ? deadlineUrgency(task.deadline) : null;
  const hasMetadata = task.whenDate || task.scheduledTime || task.deadline || task.recurrenceType;

  const [dateOpen, setDateOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [intervalValue, setIntervalValue] = useState(task.recurrenceInterval ?? 1);
  useEffect(() => { setIntervalValue(task.recurrenceInterval ?? 1); }, [task.recurrenceInterval]);

  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const subtaskRef = useRef<HTMLInputElement>(null);
  const subtaskSubmittedRef = useRef(false);

  useEffect(() => {
    if (addingSubtask) subtaskRef.current?.focus();
  }, [addingSubtask]);

  async function submitSubtask() {
    if (subtaskSubmittedRef.current) return;
    const title = subtaskTitle.trim();
    if (!title) { setAddingSubtask(false); return; }
    subtaskSubmittedRef.current = true;
    await createTask.mutateAsync({ title, parentTaskId: task.id });
    subtaskSubmittedRef.current = false;
    setSubtaskTitle("");
    // keep input open for rapid multi-entry
  }

  function handleSubtaskKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); submitSubtask(); }
    if (e.key === "Escape") { setSubtaskTitle(""); setAddingSubtask(false); }
  }

  return (
    <div className="flex flex-col">
      {/* Notes */}
      <div className="pb-3" style={{ paddingLeft: "3.25rem", paddingRight: "1rem" }}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={onSave}
          placeholder="Notes"
          rows={1}
          className="w-full bg-transparent text-xs text-muted-foreground resize-none outline-none placeholder:text-muted-foreground/45 leading-relaxed"
        />
      </div>

      <Separator className="opacity-40" />

      {/* Metadata bar */}
      <div
        className="flex items-center gap-3 py-2 text-xs text-muted-foreground flex-wrap"
        style={{ paddingLeft: "3.25rem", paddingRight: "1rem" }}
      >
        {/* When date — picker */}
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <button className={cn(
              "flex items-center gap-1.5 transition-colors rounded px-1 -mx-1",
              task.whenDate
                ? "text-foreground/70 hover:text-foreground"
                : "text-muted-foreground/60 hover:text-muted-foreground/75",
            )}>
              <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{task.whenDate ? formatWhenDate(task.whenDate) : "Set date"}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={task.whenDate ? new Date(task.whenDate + "T00:00:00") : undefined}
              onSelect={(date) => {
                if (date) {
                  const y = date.getFullYear();
                  const m = String(date.getMonth() + 1).padStart(2, "0");
                  const d = String(date.getDate()).padStart(2, "0");
                  onDateChange(`${y}-${m}-${d}`);
                } else {
                  onDateChange(null);
                }
                setDateOpen(false);
              }}
            />
            {task.whenDate && (
              <div className="border-t border-border/50 px-3 pb-3 pt-2">
                <button
                  className="flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-destructive/70 transition-colors"
                  onClick={() => { onDateChange(null); setDateOpen(false); }}
                >
                  <X className="h-3 w-3" /> Clear date
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Time-of-day segmented control — only when a date is set */}
        {task.whenDate && (
          <div className="flex items-center gap-0.5 rounded-md border border-border/50 p-0.5">
            {TIME_OF_DAY_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onTimeOfDayChange(task.timeOfDay === value ? null : value)}
                className={cn(
                  "px-1.5 py-0.5 text-xs rounded transition-colors",
                  task.timeOfDay === value
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground/65 hover:text-muted-foreground/75",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {task.scheduledTime && (
          <button
            className="flex items-center gap-1.5 text-teal-600/80 dark:text-teal-400/80 hover:text-destructive/70 dark:hover:text-destructive/70 transition-colors"
            onClick={onClearScheduledTime}
            title="Clear scheduled time"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{fmtTime(task.scheduledTime)}</span>
            <span className="text-muted-foreground/60 text-xs">· click to clear</span>
          </button>
        )}

        {/* Deadline — picker */}
        <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
          <PopoverTrigger asChild>
            <button className={cn(
              "flex items-center gap-1.5 transition-colors rounded px-1 -mx-1",
              task.deadline
                ? urgency === "overdue"
                  ? "text-destructive"
                  : urgency === "soon"
                    ? "text-amber-500 dark:text-amber-400"
                    : "text-muted-foreground"
                : "text-muted-foreground/60 hover:text-muted-foreground/75",
            )}>
              <Flag className="h-3.5 w-3.5 shrink-0" />
              {task.deadline && deadlineDays !== null ? (
                <>
                  <span>Deadline: {formatWhenDate(task.deadline)}</span>
                  <span className="text-muted-foreground/70">
                    {deadlineDays < 0
                      ? `· ${Math.abs(deadlineDays)}d overdue`
                      : deadlineDays === 0
                        ? "· today"
                        : `· ${deadlineDays}d left`}
                  </span>
                </>
              ) : (
                <span>Set deadline</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={task.deadline ? new Date(task.deadline + "T00:00:00") : undefined}
              onSelect={(date) => {
                if (date) {
                  const y = date.getFullYear();
                  const m = String(date.getMonth() + 1).padStart(2, "0");
                  const d = String(date.getDate()).padStart(2, "0");
                  onDeadlineChange(`${y}-${m}-${d}`);
                } else {
                  onDeadlineChange(null);
                }
                setDeadlineOpen(false);
              }}
            />
            {task.deadline && (
              <div className="border-t border-border/50 px-3 pb-3 pt-2">
                <button
                  className="flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-destructive/70 transition-colors"
                  onClick={() => { onDeadlineChange(null); setDeadlineOpen(false); }}
                >
                  <X className="h-3 w-3" /> Clear deadline
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Recurrence picker */}
        <Popover open={recurrenceOpen} onOpenChange={setRecurrenceOpen}>
          <PopoverTrigger asChild>
            <button className={cn(
              "flex items-center gap-1.5 transition-colors rounded px-1 -mx-1",
              task.recurrenceType
                ? "text-foreground/70 hover:text-foreground"
                : "text-muted-foreground/60 hover:text-muted-foreground/75",
            )}>
              <Repeat2 className="h-3.5 w-3.5 shrink-0" />
              <span>
                {task.recurrenceType
                  ? recurrenceLabel(task.recurrenceType, task.recurrenceInterval)
                  : "Repeat"}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="flex flex-col gap-0.5">
              {RECURRENCE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => {
                    if (task.recurrenceType === value) {
                      onRecurrenceChange({ recurrenceType: null, recurrenceMode: null });
                    } else {
                      onRecurrenceChange({ recurrenceType: value, recurrenceMode: (task.recurrenceMode as RecurrenceMode | null) ?? "on_schedule" });
                    }
                    setRecurrenceOpen(false);
                  }}
                  className={cn(
                    "flex items-center justify-between w-full px-2 py-1.5 rounded text-sm text-left transition-colors",
                    task.recurrenceType === value
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-foreground/80",
                  )}
                >
                  {label}
                  {task.recurrenceType === value && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
              {task.recurrenceType && (
                <>
                  <div className="border-t border-border/50 my-1" />
                  <div className="flex items-center gap-1.5 px-2 py-1">
                    <span className="text-xs text-muted-foreground/70 flex-shrink-0">Every</span>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={intervalValue}
                      onChange={(e) => setIntervalValue(Math.max(1, parseInt(e.target.value) || 1))}
                      onBlur={() => {
                        if (intervalValue !== (task.recurrenceInterval ?? 1)) {
                          onRecurrenceChange({
                            recurrenceType: task.recurrenceType as RecurrenceType,
                            recurrenceMode: (task.recurrenceMode as RecurrenceMode) ?? "on_schedule",
                            recurrenceInterval: intervalValue,
                          });
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-10 bg-background border border-border rounded px-1 py-0.5 text-xs text-center outline-none focus:ring-1 focus:ring-primary/50 tabular-nums"
                    />
                    <span className="text-xs text-muted-foreground/70 flex-shrink-0">
                      {task.recurrenceType === "daily" ? "day(s)" :
                       task.recurrenceType === "weekly" ? "week(s)" :
                       task.recurrenceType === "monthly" ? "month(s)" : "year(s)"}
                    </span>
                  </div>
                  <div className="border-t border-border/50 my-1" />
                  <p className="text-xs text-muted-foreground/70 px-2 pb-1">Reschedule mode</p>
                  {(["on_schedule", "after_completion"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        onRecurrenceChange({ recurrenceType: task.recurrenceType as RecurrenceType, recurrenceMode: mode });
                        setRecurrenceOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between w-full px-2 py-1.5 rounded text-xs text-left transition-colors",
                        task.recurrenceMode === mode
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted text-foreground/60",
                      )}
                    >
                      {mode === "on_schedule" ? "On schedule" : "After completion"}
                      {task.recurrenceMode === mode && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                  <div className="border-t border-border/50 my-1" />
                  <button
                    onClick={() => {
                      onRecurrenceChange({ recurrenceType: null, recurrenceMode: null });
                      setRecurrenceOpen(false);
                    }}
                    className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-xs text-muted-foreground/70 hover:text-destructive/70 hover:bg-muted transition-colors"
                  >
                    <X className="h-3 w-3" /> Remove recurrence
                  </button>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {!hasMetadata && !subtasks.length && (
          <span className="text-muted-foreground/60 sr-only">No date set</span>
        )}

        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Subtasks */}
      {(subtasks.length > 0 || addingSubtask) && (
        <>
          <Separator className="opacity-40" />
          <div className="flex flex-col py-2" style={{ paddingLeft: "3.25rem", paddingRight: "1rem" }}>
            {subtasks.map((sub) => (
              <div key={sub.id} className="flex items-center gap-2 py-0.5 group/sub">
                <Checkbox
                  checked={sub.isCompleted}
                  disabled={sub.isCompleted}
                  onCheckedChange={() => !sub.isCompleted && completeSubtask.mutate({ id: sub.id })}
                  className="h-3.5 w-3.5"
                />
                <span
                  className={cn(
                    "text-xs flex-1",
                    sub.isCompleted ? "text-muted-foreground/65" : "text-foreground/80",
                  )}
                >
                  {sub.title}
                </span>
              </div>
            ))}

            {addingSubtask && (
              <div className="flex items-center gap-2 py-0.5">
                <div className="h-3.5 w-3.5 rounded-sm border border-border/60 shrink-0" />
                <input
                  ref={subtaskRef}
                  value={subtaskTitle}
                  onChange={(e) => setSubtaskTitle(e.target.value)}
                  onKeyDown={handleSubtaskKeyDown}
                  onBlur={() => { submitSubtask(); setAddingSubtask(false); }}
                  placeholder="New subtask"
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/45"
                  disabled={createTask.isPending}
                />
              </div>
            )}

            {subtasks.length > 0 && (
              <p className="text-xs text-muted-foreground/65 mt-1">
                {completedSubtasks}/{subtasks.length} completed
              </p>
            )}
          </div>
        </>
      )}

      {/* Add subtask trigger */}
      <div style={{ paddingLeft: "3.25rem", paddingRight: "1rem" }} className="pb-2.5">
        {!addingSubtask && (
          <button
            onClick={() => setAddingSubtask(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground/75 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add subtask
          </button>
        )}
      </div>
    </div>
  );
}

function DeadlineBadge({ deadline }: { deadline: string }) {
  const urgency = deadlineUrgency(deadline);
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs px-1.5 py-0 tabular-nums font-normal h-4",
        urgency === "overdue" && "border-destructive/40 text-destructive",
        urgency === "soon" && "border-orange-400/40 text-orange-500 dark:text-orange-400",
        urgency === "normal" && "border-border text-muted-foreground/70",
      )}
    >
      {formatWhenDate(deadline)}
    </Badge>
  );
}
