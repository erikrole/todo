"use client";

import { use, useEffect, useRef, useState } from "react";
import { notFound } from "next/navigation";
import { useTasks } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useSections, useCreateSection, useUpdateSection } from "@/hooks/use-sections";
import { ViewHeader } from "@/components/upshot/view-header";
import { TaskList } from "@/components/tasks/task-list";
import { SectionBlock } from "@/components/projects/section-block";
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
import { Plus } from "lucide-react";

export default function V2ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: tasks = [], isLoading } = useTasks("all", id);
  const { data: projects = [] } = useProjects();
  const { data: sections = [] } = useSections(id);
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const queryClient = useQueryClient();
  const project = projects.find((p) => p.id === id);

  const [activeDragSection, setActiveDragSection] = useState<Section | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const [addingSection, setAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const sectionInputRef = useRef<HTMLInputElement>(null);
  const sectionSubmittedRef = useRef(false);

  useEffect(() => {
    if (!addingSection) return;
    const t = setTimeout(() => sectionInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [addingSection]);

  const activeTasks = tasks.filter((t) => !t.isCompleted && !t.isCancelled);
  const completedTasks = tasks.filter((t) => t.isCompleted && !t.isCancelled);
  const unsectionedActive = activeTasks.filter((t) => !t.sectionId);

  function tasksForSection(section: Section) {
    return activeTasks.filter((t) => t.sectionId === section.id);
  }

  async function submitSection() {
    if (sectionSubmittedRef.current) return;
    sectionSubmittedRef.current = true;
    const title = newSectionTitle.trim();
    if (!title) {
      sectionSubmittedRef.current = false;
      setAddingSection(false);
      return;
    }
    const maxPos = sections.length > 0 ? Math.max(...sections.map((s) => s.position)) : 0;
    setNewSectionTitle("");
    setAddingSection(false);
    try {
      await createSection.mutateAsync({ projectId: id, title, position: maxPos + 1 });
    } finally {
      sectionSubmittedRef.current = false;
    }
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
            ? next.position / 2
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

  if (!isLoading && projects.length > 0 && !project) notFound();

  const isEmpty =
    !isLoading &&
    activeTasks.length === 0 &&
    completedTasks.length === 0 &&
    sections.length === 0;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 0 48px" }}>
      <ViewHeader
        title={project?.name ?? "Project"}
        subtitle={
          activeTasks.length > 0
            ? `${activeTasks.length} task${activeTasks.length === 1 ? "" : "s"}`
            : undefined
        }
      />

      {isLoading ? (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: 36, borderRadius: 8, background: "var(--surface-2)" }} />
          ))}
        </div>
      ) : isEmpty ? (
        <div style={{ padding: "48px 16px", textAlign: "center" }}>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              color: "var(--ink-2)",
              margin: "0 0 4px 0",
            }}
          >
            No tasks yet.
          </p>
          <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>
            Add a task to get started.
          </p>
        </div>
      ) : (
        <div style={{ padding: "0 4px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Unsectioned tasks */}
          <TaskList
            tasks={unsectionedActive}
            activeSections={sections}
            quickAddDefaults={{ projectId: id }}
          />

          {/* Sections */}
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
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {sections.map((section) => (
                    <SectionBlock
                      key={section.id}
                      section={section}
                      tasks={tasksForSection(section)}
                      allSections={sections}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeDragSection && (
                  <div
                    style={{
                      background: "var(--surface-1)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--ink-3)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    }}
                  >
                    {activeDragSection.title}
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}

          {/* Add Section */}
          {addingSection ? (
            <div style={{ display: "flex", alignItems: "center", padding: "4px 12px 4px 24px" }}>
              <input
                ref={sectionInputRef}
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                onKeyDown={handleSectionKeyDown}
                onBlur={submitSection}
                placeholder="Section name"
                style={{
                  flex: 1,
                  background: "transparent",
                  fontSize: 13,
                  outline: "none",
                  border: "none",
                  borderBottom: "1px solid var(--border)",
                  paddingBottom: 4,
                  color: "var(--ink-1)",
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                sectionSubmittedRef.current = false;
                setAddingSection(true);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                marginLeft: -2,
                background: "transparent",
                border: "none",
                color: "var(--ink-4)",
                fontSize: 12,
                cursor: "pointer",
                width: "fit-content",
                borderRadius: 6,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-4)")}
            >
              <Plus size={14} />
              New Section
            </button>
          )}

          {/* Completed */}
          {completedTasks.length > 0 && activeTasks.length > 0 && (
            <div
              style={{
                padding: "16px 14px 8px",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--ink-4)",
              }}
            >
              Completed
            </div>
          )}
          {completedTasks.length > 0 && <TaskList tasks={completedTasks} />}
        </div>
      )}
    </div>
  );
}
