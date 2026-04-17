"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAreas, useUpdateArea } from "@/hooks/use-areas";
import { useProjects, useCreateProject } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { TaskList } from "@/components/tasks/task-list";
import { DroppableZone } from "@/components/dnd/droppable-zone";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FolderOpen, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLOR_PRESETS } from "@/lib/color-presets";

export default function AreaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: areas = [] } = useAreas();
  const { data: projects = [] } = useProjects(id);
  const { data: looseTasks = [], isLoading } = useTasks("all", undefined, id);
  const updateArea = useUpdateArea();
  const createProject = useCreateProject();

  const area = areas.find((a) => a.id === id);
  const areaProjects = projects.filter((p) => !p.isCompleted);

  const [notes, setNotes] = useState("");
  useEffect(() => { setNotes(area?.notes ?? ""); }, [id, area?.notes]);

  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const newProjectRef = useRef<HTMLInputElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (addingProject) setTimeout(() => newProjectRef.current?.focus(), 50);
  }, [addingProject]);

  async function submitProject() {
    if (submittedRef.current) return;
    const name = newProjectName.trim();
    if (!name) { setAddingProject(false); return; }
    submittedRef.current = true;
    setNewProjectName("");
    setAddingProject(false);
    await createProject.mutateAsync({ name, areaId: id });
    submittedRef.current = false;
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="h-3 w-3 rounded-full flex-shrink-0 hover:ring-2 hover:ring-primary/40 hover:ring-offset-1 transition-shadow"
              style={{ backgroundColor: area?.color ?? "#6b7280" }}
              title="Change color"
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="flex flex-wrap gap-1.5" style={{ width: 110 }}>
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  className={cn(
                    "h-5 w-5 rounded-full hover:scale-110 transition-transform focus:outline-none",
                    area?.color === c && "ring-2 ring-primary/50 ring-offset-1",
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => updateArea.mutate({ id, color: c })}
                />
              ))}
              <button
                className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/30 hover:border-destructive/50 flex items-center justify-center transition-colors"
                onClick={() => updateArea.mutate({ id, color: null })}
                title="Remove color"
              >
                <X className="h-2.5 w-2.5 text-muted-foreground/40" />
              </button>
            </div>
          </PopoverContent>
        </Popover>
        <h1 className="text-3xl font-bold tracking-tight">{area?.name ?? "Area"}</h1>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => {
          const trimmed = notes.trim();
          if (trimmed !== (area?.notes ?? "").trim()) {
            updateArea.mutate({ id, notes: trimmed || null });
          }
        }}
        placeholder="Add notes…"
        rows={2}
        className="w-full bg-transparent text-sm text-muted-foreground resize-none outline-none placeholder:text-muted-foreground/25 leading-relaxed"
      />

      {/* Projects in this area */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">Projects</h2>
        <div className="grid gap-2">
          {areaProjects.map((project) => (
            <Link key={project.id} href={`/project/${project.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      {project.color && (
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
                      )}
                      <CardTitle className="text-sm font-medium">{project.name}</CardTitle>
                    </div>
                    {project.taskCount > 0 && (
                      <Badge variant="secondary" className="text-xs">{project.taskCount}</Badge>
                    )}
                  </div>
                  {project.notes && (
                    <CardDescription className="text-xs mt-1 line-clamp-1">{project.notes}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
          {addingProject && (
            <div className="flex items-center gap-2 px-1 py-1">
              <input
                ref={newProjectRef}
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); submitProject(); }
                  if (e.key === "Escape") { setNewProjectName(""); setAddingProject(false); }
                }}
                onBlur={submitProject}
                placeholder="Project name"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40 border-b border-border pb-1"
              />
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { submittedRef.current = false; setAddingProject(true); }}
          className="w-fit text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-transparent -ml-1 gap-1.5 font-normal"
        >
          <Plus className="h-3.5 w-3.5" />
          New Project
        </Button>
      </section>

      {/* Loose tasks assigned directly to this area */}
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">Tasks</h2>
        <DroppableZone id={`section:area:${id}`}>
          <TaskList
            tasks={looseTasks.filter((t) => !t.projectId && !t.isCompleted)}
            isLoading={isLoading}
            quickAddDefaults={{ areaId: id }}
            emptyMessage="No loose tasks in this area."
          />
        </DroppableZone>
      </section>
    </div>
  );
}
