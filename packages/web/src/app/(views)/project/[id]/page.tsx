"use client";

import { use } from "react";
import { useTasks } from "@/hooks/use-tasks";
import { useProjects, useCompleteProject } from "@/hooks/use-projects";
import { TaskList } from "@/components/tasks/task-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckSquare } from "lucide-react";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: tasks = [], isLoading } = useTasks("all", id);
  const { data: projects = [] } = useProjects();
  const completeProject = useCompleteProject();

  const project = projects.find((p) => p.id === id);
  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const total = tasks.length;

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {project?.color && (
              <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
            )}
            <h1 className="text-xl font-semibold">{project?.name ?? "Project"}</h1>
          </div>
          {total > 0 && (
            <p className="text-xs text-muted-foreground">{completedCount} of {total} tasks complete</p>
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
        {project?.isCompleted && (
          <Badge variant="secondary">Completed</Badge>
        )}
      </div>

      {project?.notes && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.notes}</p>
      )}

      <TaskList
        tasks={tasks.filter((t) => !t.isCompleted)}
        isLoading={isLoading}
        quickAddDefaults={{ projectId: id }}
        emptyMessage="No open tasks in this project."
      />
    </div>
  );
}
