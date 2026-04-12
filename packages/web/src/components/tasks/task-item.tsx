"use client";

import { memo, useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDraggable } from "@dnd-kit/core";
import type { Task, Section } from "@todo/shared";
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
import { deadlineUrgency, fmtTime, formatWhenDate } from "@/lib/dates";
import { parseTaskInput } from "@/lib/parse-task";
import { useCompleteTask, useCreateTask, useDeleteTask, useRestoreTask, useUncompleteTask, useUpdateTask, useTask } from "@/hooks/use-tasks";
import { notify } from "@/lib/toast";
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
  activeSections?: Section[];
  showWhenDate?: boolean;
  showCompletedTime?: boolean;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
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
  activeSections = [],
  showWhenDate,
  showCompletedTime,
}: TaskItemProps) {
  const completeTask = useCompleteTask();
  const uncompleteTask = useUncompleteTask();
  const deleteTask = useDeleteTask();
  const restoreTask = useRestoreTask();
  const updateTask = useUpdateTask();
  const [completing, setCompleting] = useState(false);
  const { focusedTaskId } = useFocusedTask();
  const isFocused = focusedTaskId === task.id;

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

  function handleComplete() {
    setCompleting(true);
    setTimeout(() => {
      completeTask.mutate(task.id, {
        onSuccess: () => notify.undoable("Task completed", () => {
          uncompleteTask.mutate(task.id);
        }),
      });
    }, 320);
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
    <AnimatePresence>
      {!completing && (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <motion.div
              ref={setRefs}
              layout
              initial={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
              transition={{ duration: 0.2 }}
              style={{ ...dragStyle, opacity: isDragging ? 0.3 : 1 }}
              className={cn(
                "transition-[border-color,background-color,box-shadow,border-radius] duration-150",
                isExpanded && "rounded-xl border border-border/70 bg-card shadow-sm my-1.5",
              )}
              data-task-id={task.id}
              data-focused={isFocused ? "true" : undefined}
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
                        isFocused
                          ? "border-primary/70 bg-primary/[0.04]"
                          : "border-transparent hover:border-primary/40 hover:bg-primary/[0.05]",
                      ),
                  isDragging ? "cursor-grabbing" : "cursor-pointer",
                )}
                onClick={() => !isDragging && onToggle(task.id)}
              >
                <div className="mt-[3px] shrink-0" onClick={(e) => e.stopPropagation()}>
                  <TaskCheckbox
                    checked={task.isCompleted}
                    onComplete={handleComplete}
                    disabled={completing}
                  />
                </div>

                {isExpanded ? (
                  <input
                    ref={titleRef}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={save}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); titleRef.current?.blur(); } }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none text-foreground"
                    placeholder="Task title"
                  />
                ) : (
                  <div className="flex flex-1 flex-col min-w-0">
                    <span
                      className={cn(
                        "text-sm leading-snug tracking-[-0.006em]",
                        task.isCompleted
                          ? "line-through text-muted-foreground/40"
                          : task.isCancelled
                            ? "line-through text-muted-foreground/25"
                            : "text-foreground",
                      )}
                    >
                      {task.title}
                    </span>
                    {((showWhenDate && task.whenDate) || task.scheduledTime || task.notes || (showCompletedTime && task.completedAt)) && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {showWhenDate && task.whenDate && (
                          <span className="text-[11px] text-muted-foreground/50 font-mono">
                            {formatWhenDate(task.whenDate)}
                          </span>
                        )}
                        {task.scheduledTime && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] text-teal-600/70 dark:text-teal-400/70 font-mono">
                            <Clock className="h-2.5 w-2.5" />
                            {fmtTime(task.scheduledTime)}
                          </span>
                        )}
                        {showCompletedTime && task.completedAt && (
                          <span className="text-[11px] text-muted-foreground/30 font-mono">
                            {new Date(task.completedAt).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                        {task.notes && (
                          <span className="text-[11px] text-muted-foreground/30">·</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!isExpanded && task.deadline && (
                  <div className="ml-auto shrink-0 self-center">
                    <DeadlineBadge deadline={task.deadline} />
                  </div>
                )}
              </div>

              {/* Inline expanded panel */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
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
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
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
            <ContextMenuItem onSelect={() => moveTask({ isSomeday: true, whenDate: null, timeOfDay: null }, "Moved to Someday")}>
              Move to Someday
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
            <ContextMenuItem onSelect={handleComplete}>Complete</ContextMenuItem>
            <ContextMenuItem
              onSelect={() => updateTask.mutate({ id: task.id, isCancelled: !task.isCancelled })}
            >
              {task.isCancelled ? "Uncancel" : "Cancel"}
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
      )}
    </AnimatePresence>
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

  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const subtaskRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingSubtask) subtaskRef.current?.focus();
  }, [addingSubtask]);

  async function submitSubtask() {
    const title = subtaskTitle.trim();
    if (!title) { setAddingSubtask(false); return; }
    await createTask.mutateAsync({ title, parentTaskId: task.id });
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
          className="w-full bg-transparent text-xs text-muted-foreground resize-none outline-none placeholder:text-muted-foreground/30 leading-relaxed"
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
                : "text-muted-foreground/30 hover:text-muted-foreground/60",
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
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-destructive/70 transition-colors"
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
                  "px-1.5 py-0.5 text-[10px] rounded transition-colors",
                  task.timeOfDay === value
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground/40 hover:text-muted-foreground/70",
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
            <span className="text-muted-foreground/30 text-[10px]">· click to clear</span>
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
                : "text-muted-foreground/30 hover:text-muted-foreground/60",
            )}>
              <Flag className="h-3.5 w-3.5 shrink-0" />
              {task.deadline && deadlineDays !== null ? (
                <>
                  <span>Deadline: {formatWhenDate(task.deadline)}</span>
                  <span className="text-muted-foreground/50">
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
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-destructive/70 transition-colors"
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
                : "text-muted-foreground/30 hover:text-muted-foreground/60",
            )}>
              <Repeat2 className="h-3.5 w-3.5 shrink-0" />
              <span>
                {task.recurrenceType
                  ? `${task.recurrenceType.charAt(0).toUpperCase()}${task.recurrenceType.slice(1)}`
                  : "Repeat"}
              </span>
              {task.recurrenceMode === "after_completion" && (
                <span className="text-muted-foreground/50 text-[10px]">· after</span>
              )}
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
                      onRecurrenceChange({ recurrenceType: value, recurrenceMode: task.recurrenceMode as RecurrenceMode ?? "on_schedule" });
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
                  <p className="text-[10px] text-muted-foreground/50 px-2 pb-1">Reschedule mode</p>
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
                    className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-xs text-muted-foreground/50 hover:text-destructive/70 hover:bg-muted transition-colors"
                  >
                    <X className="h-3 w-3" /> Remove recurrence
                  </button>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {!hasMetadata && !subtasks.length && (
          <span className="text-muted-foreground/30 sr-only">No date set</span>
        )}

        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-6 w-6 p-0 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10"
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
                  onCheckedChange={() => !sub.isCompleted && completeSubtask.mutate(sub.id)}
                  className="h-3.5 w-3.5"
                />
                <span
                  className={cn(
                    "text-xs flex-1",
                    sub.isCompleted ? "line-through text-muted-foreground/40" : "text-foreground/80",
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
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/30"
                  disabled={createTask.isPending}
                />
              </div>
            )}

            {subtasks.length > 0 && (
              <p className="text-[10px] text-muted-foreground/40 mt-1">
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
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
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
        "text-[10px] px-1.5 py-0 font-mono font-normal h-4",
        urgency === "overdue" && "border-destructive/40 text-destructive",
        urgency === "soon" && "border-orange-400/40 text-orange-500 dark:text-orange-400",
        urgency === "normal" && "border-border text-muted-foreground/50",
      )}
    >
      {formatWhenDate(deadline)}
    </Badge>
  );
}
