"use client";

import { use, useState, useRef, useEffect } from "react";
import { useTasks } from "@/hooks/use-tasks";
import { useProjects, useCompleteProject } from "@/hooks/use-projects";
import { useSections, useCreateSection } from "@/hooks/use-sections";
import { TaskList } from "@/components/tasks/task-list";
import { SectionBlock } from "@/components/projects/section-block";
import { DroppableZone } from "@/components/dnd/droppable-zone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Plus } from "lucide-react";
import type { Section } from "@todo/shared";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: tasks = [], isLoading } = useTasks("all", id);
  const { data: projects = [] } = useProjects();
  const { data: sections = [] } = useSections(id);
  const completeProject = useCompleteProject();
  const createSection = useCreateSection();

  const [addingSection, setAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const sectionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingSection) setTimeout(() => sectionInputRef.current?.focus(), 50);
  }, [addingSection]);

  const project = projects.find((p) => p.id === id);
  const openTasks = tasks.filter((t) => !t.isCompleted);
  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const total = tasks.length;

  const unsectionedTasks = openTasks.filter((t) => !t.sectionId);

  function tasksForSection(section: Section) {
    return openTasks.filter((t) => t.sectionId === section.id);
  }

  async function submitSection() {
    const title = newSectionTitle.trim();
    if (!title) {
      setAddingSection(false);
      return;
    }
    const maxPos = sections.length > 0 ? Math.max(...sections.map((s) => s.position)) : 0;
    setNewSectionTitle("");
    setAddingSection(false);
    await createSection.mutateAsync({ projectId: id, title, position: maxPos + 1 });
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

      {project?.notes && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.notes}</p>
      )}

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

      {/* Section blocks (drag reorder added in Task 8) */}
      {sections.map((section) => (
        <SectionBlock
          key={section.id}
          section={section}
          tasks={tasksForSection(section)}
          allSections={sections}
        />
      ))}

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
          onClick={() => setAddingSection(true)}
          className="w-fit text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-transparent -ml-1 gap-1.5 font-normal"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Section
        </Button>
      )}
    </div>
  );
}
