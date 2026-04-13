// packages/web/src/components/tasks/bulk-action-bar.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useSelection } from "@/hooks/use-selection";
import {
  useCompleteTask,
  useDeleteTask,
  useRestoreTask,
  useUncompleteTask,
  useUpdateTask,
} from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { notify } from "@/lib/toast";
import type { ProjectWithCounts } from "@todo/shared";
import { ReschedulePopover } from "./reschedule-popover";
import { MoveToProjectPopover } from "./move-to-project-popover";

export function BulkActionBar() {
  const { selectedIds, isActive, clear } = useSelection();
  const completeTask = useCompleteTask();
  const uncompleteTask = useUncompleteTask();
  const deleteTask = useDeleteTask();
  const restoreTask = useRestoreTask();
  const updateTask = useUpdateTask();
  const { data: allProjects = [] } = useProjects();
  const activeProjects = (allProjects as ProjectWithCounts[]).filter((p) => !p.isCompleted);

  const count = selectedIds.size;
  const label = `${count} task${count === 1 ? "" : "s"}`;

  function handleComplete() {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => completeTask.mutate(id));
    notify.undoable(`${label} completed`, () => ids.forEach((id) => uncompleteTask.mutate(id)));
    clear();
  }

  function handleCancel() {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => updateTask.mutate({ id, isCancelled: true }));
    notify.undoable(`${label} cancelled`, () =>
      ids.forEach((id) => updateTask.mutate({ id, isCancelled: false })),
    );
    clear();
  }

  function handleSomeday() {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => updateTask.mutate({ id, isSomeday: true, whenDate: null, timeOfDay: null }));
    clear();
  }

  function handleDelete() {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => deleteTask.mutate(id));
    notify.undoable(`${label} deleted`, () => ids.forEach((id) => restoreTask.mutate(id)));
    clear();
  }

  function handleReschedule(whenDate: string) {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => updateTask.mutate({ id, whenDate, isSomeday: false }));
    clear();
  }

  function handleMoveToProject(projectId: string) {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => updateTask.mutate({ id, projectId }));
    clear();
  }

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          data-testid="bulk-action-bar"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-popover shadow-lg"
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
