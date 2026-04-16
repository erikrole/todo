"use client";

import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTasks } from "@/hooks/use-tasks";
import { RoutineItem } from "@/components/routines/routine-item";

export default function RoutinesPage() {
  const { data: tasks = [], isLoading } = useTasks("routines");

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Routines</h1>
        <Button variant="ghost" size="sm" onClick={() => {}}>
          <Upload className="h-4 w-4 mr-1.5" />
          Import
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground px-4">Loading...</div>
      ) : tasks.length === 0 ? (
        <div className="text-sm text-muted-foreground px-4">
          No routines yet. Add a recurring task to see it here.
        </div>
      ) : (
        <div className="flex flex-col">
          {tasks.map((task) => (
            <RoutineItem key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
