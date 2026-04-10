"use client";

import { memo, useState, useEffect, useRef } from "react";
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
import { deadlineUrgency, formatWhenDate } from "@/lib/dates";
import { useCompleteTask, useCreateTask, useDeleteTask, useUpdateTask, useTask } from "@/hooks/use-tasks";
import { Calendar, Clock, Flag, ListTree, Plus, Repeat2, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

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

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
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
  const deleteTask = useDeleteTask();
  const updateTask = useUpdateTask();
  const [completing, setCompleting] = useState(false);

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes ?? "");
  }, [task.id]);

  useEffect(() => {
    if (!isExpanded) return;
    const timer = setTimeout(() => titleRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [isExpanded]);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const dragStyle = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  function handleComplete() {
    setCompleting(true);
    setTimeout(() => completeTask.mutate(task.id), 320);
  }

  function save() {
    const trimmed = title.trim();
    if (!trimmed) { setTitle(task.title); return; }
    if (trimmed === task.title && notes === (task.notes ?? "")) return;
    updateTask.mutate({ id: task.id, title: trimmed, notes: notes || null });
  }

  return (
    <AnimatePresence>
      {!completing && (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <motion.div
              ref={(el) => setNodeRef(el as HTMLElement | null)}
              layout
              initial={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
              transition={{ duration: 0.2 }}
              style={{ ...dragStyle, opacity: isDragging ? 0.3 : 1 }}
              className={cn(
                "transition-[border-color,background-color,box-shadow,border-radius] duration-150",
                isExpanded && "rounded-xl border border-border/70 bg-card shadow-sm my-1.5",
              )}
              {...attributes}
              {...listeners}
            >
              {/* Title row */}
              <div
                className={cn(
                  "group relative flex items-start gap-3 py-2",
                  isExpanded
                    ? "px-4 pt-3.5"
                    : "pl-4 pr-3 border-l-2 border-transparent hover:border-primary/40 hover:bg-primary/[0.05]",
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
                      onDelete={() => deleteTask.mutate(task.id)}
                      onClearScheduledTime={() => updateTask.mutate({ id: task.id, scheduledTime: null })}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </ContextMenuTrigger>

          <ContextMenuContent className="w-52">
            <ContextMenuItem
              onSelect={() =>
                updateTask.mutate({ id: task.id, whenDate: todayStr(), timeOfDay: null, isSomeday: false })
              }
            >
              Move to Today
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() =>
                updateTask.mutate({ id: task.id, whenDate: null, timeOfDay: null, isSomeday: false })
              }
            >
              Move to Inbox
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => updateTask.mutate({ id: task.id, whenDate: tomorrowStr(), isSomeday: false })}
            >
              Move to Upcoming
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() =>
                updateTask.mutate({ id: task.id, isSomeday: true, whenDate: null, timeOfDay: null })
              }
            >
              Move to Someday
            </ContextMenuItem>
            {activeProjects.length > 0 && (
              <ContextMenuSub>
                <ContextMenuSubTrigger>Move to Project</ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  {activeProjects.map((p) => (
                    <ContextMenuItem
                      key={p.id}
                      onSelect={() => updateTask.mutate({ id: task.id, projectId: p.id })}
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
                  <ContextMenuItem
                    onSelect={() => updateTask.mutate({ id: task.id, sectionId: null })}
                  >
                    No Section
                  </ContextMenuItem>
                  {activeSections.map((s) => (
                    <ContextMenuItem
                      key={s.id}
                      onSelect={() => updateTask.mutate({ id: task.id, sectionId: s.id })}
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
              onSelect={() => deleteTask.mutate(task.id)}
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
function ExpandedPanel({
  task,
  notes,
  setNotes,
  onSave,
  onDelete,
  onClearScheduledTime,
}: {
  task: Task;
  notes: string;
  setNotes: (v: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onClearScheduledTime: () => void;
}) {
  const { data: fullTask } = useTask(task.id);
  const createTask = useCreateTask();
  const completeSubtask = useCompleteTask();
  const subtasks = fullTask?.subtasks ?? [];
  const completedSubtasks = subtasks.filter((s) => s.isCompleted).length;
  const deadlineDays = task.deadline ? daysUntil(task.deadline) : null;
  const urgency = task.deadline ? deadlineUrgency(task.deadline) : null;
  const hasMetadata = task.whenDate || task.scheduledTime || task.deadline || task.recurrenceType;

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
        {task.whenDate && (
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-primary/60" />
            <span className="text-foreground/70">{formatWhenDate(task.whenDate)}</span>
            {task.timeOfDay && (
              <span className="text-muted-foreground/50">
                · {task.timeOfDay.charAt(0).toUpperCase() + task.timeOfDay.slice(1)}
              </span>
            )}
          </span>
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

        {task.deadline && deadlineDays !== null && (
          <span
            className={cn(
              "flex items-center gap-1.5",
              urgency === "overdue" && "text-destructive",
              urgency === "soon" && "text-amber-500 dark:text-amber-400",
              urgency === "normal" && "text-muted-foreground",
            )}
          >
            <Flag className="h-3.5 w-3.5" />
            <span>Deadline: {formatWhenDate(task.deadline)}</span>
            <span className="text-muted-foreground/50">
              {deadlineDays < 0
                ? `· ${Math.abs(deadlineDays)}d overdue`
                : deadlineDays === 0
                  ? "· today"
                  : `· ${deadlineDays}d left`}
            </span>
          </span>
        )}

        {task.recurrenceType && (
          <span className="flex items-center gap-1.5">
            <Repeat2 className="h-3.5 w-3.5" />
            <span>{task.recurrenceType}</span>
          </span>
        )}

        {!hasMetadata && !subtasks.length && (
          <span className="text-muted-foreground/30">No date set</span>
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
