"use client";

import { use } from "react";
import Link from "next/link";
import { useAreas } from "@/hooks/use-areas";
import { useProjects } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { TaskList } from "@/components/tasks/task-list";
import { DroppableZone } from "@/components/dnd/droppable-zone";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderOpen } from "lucide-react";

export default function AreaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: areas = [] } = useAreas();
  const { data: projects = [] } = useProjects(id);
  const { data: looseTasks = [], isLoading } = useTasks("all", undefined, id);

  const area = areas.find((a) => a.id === id);
  const areaProjects = projects.filter((p) => !p.isCompleted);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center gap-2">
        {area?.color && (
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: area.color }} />
        )}
        <h1 className="text-xl font-semibold">{area?.name ?? "Area"}</h1>
      </div>

      {area?.notes && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{area.notes}</p>
      )}

      {/* Projects in this area */}
      {areaProjects.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Projects</h2>
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
          </div>
        </section>
      )}

      {/* Loose tasks assigned directly to this area */}
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tasks</h2>
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
