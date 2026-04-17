"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTasks } from "@/hooks/use-tasks";
import { RoutineItem } from "@/components/routines/routine-item";
import { ImportSheet } from "@/components/routines/import-sheet";
import { toLocalDateStr } from "@/lib/dates";
import type { Task } from "@todo/shared";

function useSummaryStats(tasks: Task[]) {
  const today = toLocalDateStr(new Date());
  let overdue = 0;
  let dueSoon = 0;
  let healthy = 0;

  tasks.forEach((task) => {
    const daysToGo = task.whenDate
      ? Math.round(
          (Date.parse(task.whenDate + "T00:00:00") - Date.parse(today + "T00:00:00")) / 86400000,
        )
      : null;
    if (daysToGo === null) {
      healthy++;
    } else if (daysToGo < 0) {
      overdue++;
    } else if (daysToGo <= 2) {
      dueSoon++;
    } else {
      healthy++;
    }
  });

  return { overdue, dueSoon, healthy };
}

export default function RoutinesPage() {
  const [importOpen, setImportOpen] = useState(false);
  const { data: tasks = [], isLoading } = useTasks("routines");
  const { overdue, dueSoon, healthy } = useSummaryStats(tasks);

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Routines</h1>
        <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4 mr-1.5" />
          Import
        </Button>
      </div>

      {/* Summary chips */}
      {!isLoading && tasks.length > 0 && (
        <div className="flex items-center gap-2 text-xs font-semibold">
          {overdue > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-destructive/15 text-destructive">
              {overdue} overdue
            </span>
          )}
          {dueSoon > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
              {dueSoon} due soon
            </span>
          )}
          {healthy > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground/80">
              {healthy} on track
            </span>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground px-4">Loading...</div>
      ) : tasks.length === 0 ? (
        <div className="text-sm text-muted-foreground px-4">
          No routines yet. Add a recurring task to see it here.
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {tasks.map((task, i) => (
            <RoutineItem key={task.id} task={task} index={i} />
          ))}
        </div>
      )}

      <ImportSheet open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
