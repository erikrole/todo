"use client";

import { use, useState, useRef, useEffect } from "react";
import { useTasks } from "@/hooks/use-tasks";
import { useProjects, useCompleteProject, useUpdateProject } from "@/hooks/use-projects";
import { useSections, useCreateSection, useUpdateSection } from "@/hooks/use-sections";
import { TaskList } from "@/components/tasks/task-list";
import { SectionBlock } from "@/components/projects/section-block";
import { DroppableZone } from "@/components/dnd/droppable-zone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Plus } from "lucide-react";
import type { Section } from "@todo/shared";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: tasks = [], isLoading } = useTasks("all", id);
  const { data: projects = [] } = useProjects();
  const { data: sections = [] } = useSections(id);
  const completeProject = useCompleteProject();
  const updateProject = useUpdateProject();
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();
  const [activeDragSection, setActiveDragSection] = useState<Section | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const [addingSection, setAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const sectionInputRef = useRef<HTMLInputElement>(null);
  const sectionSubmittedRef = useRef(false);

  useEffect(() => {
    if (addingSection) setTimeout(() => sectionInputRef.current?.focus(), 50);
  }, [addingSection]);

  const project = projects.find((p) => p.id === id);

  // Sync notes when project data arrives
  useEffect(() => {
    setNotes(project?.notes ?? "");
  }, [id, project?.notes]);

  const openTasks = tasks.filter((t) => !t.isCompleted);
  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const total = tasks.length;

  const unsectionedTasks = openTasks.filter((t) => !t.sectionId);

  function tasksForSection(section: Section) {
    return openTasks.filter((t) => t.sectionId === section.id);
  }

  async function submitSection() {
    if (sectionSubmittedRef.current) return;
    sectionSubmittedRef.current = true;
    const title = newSectionTitle.trim();
    if (!title) { setAddingSection(false); return; }
    const maxPos = sections.length > 0 ? Math.max(...sections.map((s) => s.position)) : 0;
    setNewSectionTitle("");
    setAddingSection(false);
    await createSection.mutateAsync({ projectId: id, title, position: maxPos + 1 });
  }

  function handleSectionDragStart(event: DragStartEvent) {
    const sec = sections.find((s) => s.id === event.active.id);
    setActiveDragSection(sec ?? null);
  }

  function handleSectionDragEnd(event: DragEndEvent) {
    setActiveDragSection(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sections, oldIndex, newIndex);

    // Capture snapshot before optimistic write so rollback is correct even if
    // another mutation updated the cache between drag-start and drag-end.
    const snapshot = queryClient.getQueryData(["sections", id]);
    queryClient.setQueryData(["sections", id], reordered);

    const prev = reordered[newIndex - 1];
    const next = reordered[newIndex + 1];
    const newPosition =
      prev && next
        ? (prev.position + next.position) / 2
        : prev
          ? prev.position + 1
          : next
            ? next.position - 1
            : 0;

    updateSection.mutate(
      { id: active.id as string, projectId: id, position: newPosition },
      {
        onError: () => {
          queryClient.setQueryData(["sections", id], snapshot);
        },
      },
    );
  }

  function handleSectionKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      submitSection();
    }
    if (e.key === "Escape") {
      setNewSectionTitle("");
      setAddingSection(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {project?.color && (
              <span
                className="h-3 w-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color }}
              />
            )}
            <h1 className="text-lg font-semibold tracking-tight">{project?.name ?? "Project"}</h1>
          </div>
          {total > 0 && (
            <p className="text-xs text-muted-foreground">
              {completedCount} of {total} tasks complete
            </p>
          )}
        </div>
        {project && !project.isCompleted && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => completeProject.mutate({ id: project.id })}
            disabled={completeProject.isPending}
          >
            <CheckSquare className="h-4 w-4 mr-1" />
            Complete project
          </Button>
        )}
        {project?.isCompleted && <Badge variant="secondary">Completed</Badge>}
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => {
          const trimmed = notes.trim();
          if (trimmed !== (project?.notes ?? "").trim()) {
            updateProject.mutate({ id, notes: trimmed || null });
          }
        }}
        placeholder="Add notes…"
        rows={2}
        className="w-full bg-transparent text-sm text-muted-foreground resize-none outline-none placeholder:text-muted-foreground/25 leading-relaxed"
      />

      {/* Unsectioned tasks */}
      <DroppableZone id={`section:project:${id}`}>
        <TaskList
          tasks={unsectionedTasks}
          isLoading={isLoading}
          activeSections={sections}
          quickAddDefaults={{ projectId: id }}
          emptyMessage={sections.length === 0 ? "No open tasks in this project." : undefined}
        />
      </DroppableZone>

      {/* Section blocks with drag reorder */}
      {sections.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleSectionDragStart}
          onDragEnd={handleSectionDragEnd}
        >
          <SortableContext
            items={sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {sections.map((section) => (
              <SectionBlock
                key={section.id}
                section={section}
                tasks={tasksForSection(section)}
                allSections={sections}
              />
            ))}
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeDragSection && (
              <div className="bg-card border border-border rounded-md px-3 py-1.5 shadow-lg text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {activeDragSection.title}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Add Section */}
      {addingSection ? (
        <div className="flex items-center gap-2 pl-6 pr-3 py-1">
          <input
            ref={sectionInputRef}
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            onKeyDown={handleSectionKeyDown}
            onBlur={submitSection}
            placeholder="Section name"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40 border-b border-border pb-1"
          />
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
          sectionSubmittedRef.current = false;
          setAddingSection(true);
        }}
          className="w-fit text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-transparent -ml-1 gap-1.5 font-normal"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Section
        </Button>
      )}
    </div>
  );
}
