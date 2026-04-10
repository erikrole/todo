"use client";

import { useState, useEffect } from "react";
import type { Task, TimeOfDay, RecurrenceType, RecurrenceMode } from "@todo/shared";
import { useUpdateTask, useDeleteTask, useTask } from "@/hooks/use-tasks";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Hourglass, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskDetailProps {
  task: Task;
  open: boolean;
  onClose: () => void;
}

export function TaskDetail({ task, open, onClose }: TaskDetailProps) {
  const { data: fullTask } = useTask(task.id);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [whenDate, setWhenDate] = useState(task.whenDate ?? "");
  const [deadline, setDeadline] = useState(task.deadline ?? "");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay | "none">(task.timeOfDay ?? "none");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType | "none">(task.recurrenceType ?? "none");
  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>("on_schedule");
  const [recurrenceInterval, setRecurrenceInterval] = useState(task.recurrenceInterval ?? 1);
  const [isSomeday, setIsSomeday] = useState(task.isSomeday);

  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes ?? "");
    setWhenDate(task.whenDate ?? "");
    setDeadline(task.deadline ?? "");
    setTimeOfDay(task.timeOfDay ?? "none");
    setRecurrenceType(task.recurrenceType ?? "none");
    setRecurrenceMode(task.recurrenceMode ?? "on_schedule");
    setRecurrenceInterval(task.recurrenceInterval ?? 1);
    setIsSomeday(task.isSomeday);
  }, [task]);

  function save(overrides?: { timeOfDay?: TimeOfDay | "none"; recurrenceType?: RecurrenceType | "none"; recurrenceMode?: RecurrenceMode; isSomeday?: boolean; whenDate?: string }) {
    const tod = overrides?.timeOfDay ?? timeOfDay;
    const rt = overrides?.recurrenceType ?? recurrenceType;
    const rm = overrides?.recurrenceMode ?? recurrenceMode;
    const sd = overrides?.isSomeday ?? isSomeday;
    const wd = overrides?.whenDate !== undefined ? overrides.whenDate : whenDate;
    updateTask.mutate({
      id: task.id,
      title,
      notes: notes || null,
      whenDate: wd || null,
      deadline: deadline || null,
      isSomeday: sd,
      timeOfDay: tod !== "none" ? tod : null,
      recurrenceType: rt !== "none" ? rt : null,
      recurrenceMode: rt !== "none" ? rm : null,
      recurrenceInterval: rt !== "none" ? recurrenceInterval : null,
    });
  }

  function handleDelete() {
    deleteTask.mutate(task.id);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { save(); onClose(); } }}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="sr-only">Task detail</SheetTitle>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => save()}
            className="text-base font-medium border-none shadow-none px-0 focus-visible:ring-0"
            placeholder="Task title"
          />
        </SheetHeader>

        <Separator />

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => save()}
              placeholder="Add notes…"
              className="min-h-[80px] resize-none text-sm"
            />
          </div>

          {/* When date */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">When</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={isSomeday ? "" : whenDate}
                disabled={isSomeday}
                onChange={(e) => {
                  setWhenDate(e.target.value);
                  if (e.target.value) setIsSomeday(false);
                }}
                onBlur={() => save()}
                className="flex-1 text-sm"
              />
              <Button
                type="button"
                variant={isSomeday ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  const next = !isSomeday;
                  setIsSomeday(next);
                  if (next) {
                    setWhenDate("");
                    save({ isSomeday: true, whenDate: "" });
                  } else {
                    save({ isSomeday: false });
                  }
                }}
              >
                <Hourglass className="h-3.5 w-3.5" />
                Someday
              </Button>
            </div>
          </div>

          {/* Time of day (only relevant when whenDate is set) */}
          {whenDate && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Time of day</Label>
              <Select value={timeOfDay} onValueChange={(v) => { const val = v as TimeOfDay | "none"; setTimeOfDay(val); save({ timeOfDay: val }); }}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Any time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any time</SelectItem>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="night">Night</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Deadline */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Deadline</Label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              onBlur={() => save()}
              className="text-sm"
            />
          </div>

          {/* Recurrence */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Repeat</Label>
            <Select value={recurrenceType} onValueChange={(v) => { const val = v as RecurrenceType | "none"; setRecurrenceType(val); save({ recurrenceType: val }); }}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Never" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Never</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="custom">Custom…</SelectItem>
              </SelectContent>
            </Select>

            {recurrenceType !== "none" && (
              <div className="flex flex-col gap-2 pl-1">
                {/* Mode */}
                <div className="flex gap-2">
                  {(["on_schedule", "after_completion"] as RecurrenceMode[]).map((mode) => (
                    <Button
                      key={mode}
                      type="button"
                      size="sm"
                      variant={recurrenceMode === mode ? "default" : "outline"}
                      onClick={() => { setRecurrenceMode(mode); save({ recurrenceMode: mode }); }}
                    >
                      {mode === "on_schedule" ? "On schedule" : "After completion"}
                    </Button>
                  ))}
                </div>

                {/* Interval */}
                {recurrenceType === "custom" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Every</span>
                    <Input
                      type="number"
                      min={1}
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(Number(e.target.value))}
                      onBlur={() => save()}
                      className="w-16 text-sm h-7"
                    />
                    <span className="text-xs text-muted-foreground">days</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subtasks */}
          {fullTask?.subtasks && fullTask.subtasks.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Subtasks</Label>
              <div className="flex flex-col gap-1">
                {fullTask.subtasks.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2 text-sm">
                    <span className={cn(sub.isCompleted && "line-through text-muted-foreground")}>
                      {sub.title}
                    </span>
                    {sub.isCompleted && <Badge variant="secondary" className="text-xs">Done</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />
        <div className="p-4 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
