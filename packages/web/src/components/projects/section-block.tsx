"use client";

import { useState, useRef, useEffect } from "react";
import type { Section, Task } from "@todo/shared";
import { useUpdateSection, useDeleteSection } from "@/hooks/use-sections";
import { TaskList } from "@/components/tasks/task-list";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { ChevronRight, GripVertical } from "lucide-react";

interface SectionBlockProps {
  section: Section;
  tasks: Task[];
  allSections: Section[];
  // Drag handle props will be added in Task 8
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
}

export function SectionBlock({
  section,
  tasks,
  allSections,
  dragHandleProps,
  isDragging,
}: SectionBlockProps) {
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(section.title);
  const renameRef = useRef<HTMLInputElement>(null);
  const openTasks = tasks.filter((t) => !t.isCompleted);

  useEffect(() => {
    if (isRenaming) setTimeout(() => renameRef.current?.focus(), 50);
  }, [isRenaming]);

  // Keep renameValue in sync if section.title changes externally
  useEffect(() => {
    if (!isRenaming) setRenameValue(section.title);
  }, [section.title, isRenaming]);

  function submitRename() {
    const title = renameValue.trim();
    if (!title) {
      setRenameValue(section.title);
      setIsRenaming(false);
      return;
    }
    if (title !== section.title) {
      updateSection.mutate({ id: section.id, projectId: section.projectId, title });
    }
    setIsRenaming(false);
  }

  function handleRenameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      submitRename();
    }
    if (e.key === "Escape") {
      setRenameValue(section.title);
      setIsRenaming(false);
    }
  }

  function handleDelete() {
    const taskCount = openTasks.length;
    const confirmed =
      taskCount === 0 ||
      window.confirm(
        `This will unsection ${taskCount} task${taskCount === 1 ? "" : "s"}. Continue?`,
      );
    if (confirmed) {
      deleteSection.mutate({ id: section.id, projectId: section.projectId });
    }
  }

  function toggleCollapse() {
    updateSection.mutate({
      id: section.id,
      projectId: section.projectId,
      isCollapsed: !section.isCollapsed,
    });
  }

  return (
    <div className={cn("flex flex-col", isDragging && "opacity-50")}>
      {/* Section header */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex items-center gap-1.5 py-1.5 pl-1 pr-3 group/section cursor-default select-none">
            {/* Drag handle (wired in Task 8) */}
            <div
              {...dragHandleProps}
              className="opacity-0 group-hover/section:opacity-40 hover:!opacity-70 cursor-grab active:cursor-grabbing transition-opacity p-0.5"
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </div>

            {/* Chevron */}
            <button
              type="button"
              onClick={toggleCollapse}
              className="p-0.5 rounded hover:bg-muted/50 transition-colors"
            >
              <ChevronRight
                className={cn(
                  "h-3 w-3 text-muted-foreground/60 transition-transform",
                  !section.isCollapsed && "rotate-90",
                )}
              />
            </button>

            {/* Title */}
            {isRenaming ? (
              <input
                ref={renameRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={submitRename}
                className="flex-1 bg-transparent text-xs font-semibold tracking-wide text-muted-foreground uppercase outline-none border-b border-border pb-0.5"
              />
            ) : (
              <span className="flex-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {section.title}
              </span>
            )}

            {/* Task count */}
            {openTasks.length > 0 && (
              <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                {openTasks.length}
              </span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-40">
          <ContextMenuItem
            onSelect={() => {
              setRenameValue(section.title);
              setIsRenaming(true);
            }}
          >
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={handleDelete}
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Tasks */}
      {!section.isCollapsed && (
        <TaskList
          tasks={openTasks}
          activeSections={allSections}
          quickAddDefaults={{
            projectId: section.projectId,
            sectionId: section.id,
          }}
        />
      )}
    </div>
  );
}
