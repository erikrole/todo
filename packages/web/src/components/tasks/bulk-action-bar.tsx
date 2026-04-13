// packages/web/src/components/tasks/bulk-action-bar.tsx
"use client";

import { cn } from "@/lib/utils";
import { useSelection } from "@/hooks/use-selection";
import { useBatchTaskAction, useUncompleteTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { notify } from "@/lib/toast";
import type { ProjectWithCounts } from "@todo/shared";
import { ReschedulePopover } from "./reschedule-popover";
import { MoveToProjectPopover } from "./move-to-project-popover";

export function BulkActionBar() {
  const { selectedIds, isActive, clear } = useSelection();
  const batch = useBatchTaskAction();
  const uncompleteTask = useUncompleteTask();
  const { data: allProjects = [] } = useProjects();
  const activeProjects = (allProjects as ProjectWithCounts[]).filter((p) => !p.isCompleted);

  const ids = Array.from(selectedIds);
  const count = selectedIds.size;
  const label = `${count} task${count === 1 ? "" : "s"}`;

  function handleComplete() {
    batch.mutate({ action: "complete", ids }, {
      onSuccess: () => {
        notify.undoable(`${label} completed`, () =>
          Promise.all(ids.map((id) => uncompleteTask.mutateAsync(id))),
        );
        clear();
      },
    });
  }

  function handleCancel() {
    batch.mutate({ action: "update", ids, patch: { isCancelled: true } }, {
      onSuccess: () => {
        notify.undoable(`${label} cancelled`, () =>
          batch.mutateAsync({ action: "update", ids, patch: { isCancelled: false } }),
        );
        clear();
      },
    });
  }

  function handleSomeday() {
    batch.mutate(
      { action: "update", ids, patch: { isSomeday: true, whenDate: null, timeOfDay: null } },
      { onSuccess: () => clear() },
    );
  }

  function handleDelete() {
    batch.mutate({ action: "delete", ids }, {
      onSuccess: () => {
        notify.undoable(`${label} deleted`, () =>
          batch.mutateAsync({ action: "restore", ids }),
        );
        clear();
      },
    });
  }

  function handleReschedule(whenDate: string) {
    batch.mutate(
      { action: "update", ids, patch: { whenDate, isSomeday: false } },
      { onSuccess: () => clear() },
    );
  }

  function handleMoveToProject(projectId: string) {
    batch.mutate(
      { action: "update", ids, patch: { projectId } },
      { onSuccess: () => clear() },
    );
  }

  return (
    <div
      data-testid="bulk-action-bar"
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-popover shadow-lg transition-all duration-[180ms]",
        isActive ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none",
      )}
    >
      <span className="text-xs font-medium text-muted-foreground pr-1 select-none">
        {label}
      </span>

      <button
        onClick={handleComplete}
        className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
      >
        Complete
      </button>

      <ReschedulePopover onReschedule={handleReschedule} />

      <MoveToProjectPopover projects={activeProjects} onMove={handleMoveToProject} />

      <button
        onClick={handleCancel}
        className="px-2.5 py-1 rounded-md border border-border text-xs text-foreground/70 hover:bg-muted transition-colors"
      >
        Cancel
      </button>

      <button
        onClick={handleSomeday}
        className="px-2.5 py-1 rounded-md border border-border text-xs text-foreground/70 hover:bg-muted transition-colors"
      >
        Someday
      </button>

      <button
        onClick={handleDelete}
        className="px-2.5 py-1 rounded-md border border-border text-xs text-destructive hover:bg-destructive/10 transition-colors"
      >
        Delete
      </button>

      <button
        onClick={clear}
        aria-label="Clear selection"
        className="ml-1 h-5 w-5 flex items-center justify-center rounded text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors text-xs"
      >
        ✕
      </button>
    </div>
  );
}
