"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAreas } from "@/hooks/use-areas";
import { useUpdateProject } from "@/hooks/use-projects";

interface MoveProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  currentAreaId: string | null | undefined;
}

export function MoveProjectDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  currentAreaId,
}: MoveProjectDialogProps) {
  const { data: areas = [] } = useAreas();
  const { mutate: updateProject } = useUpdateProject();
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(currentAreaId ?? null);

  useEffect(() => {
    if (open) setSelectedAreaId(currentAreaId ?? null);
  }, [open, currentAreaId]);

  const handleMove = () => {
    updateProject({ id: projectId, areaId: selectedAreaId ?? null });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Move &ldquo;{projectName}&rdquo;</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 py-2 max-h-64 overflow-y-auto">
          <button
            type="button"
            onClick={() => setSelectedAreaId(null)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              selectedAreaId === null ? "bg-accent" : "hover:bg-accent/50"
            }`}
          >
            No area
          </button>
          {areas.map((area) => (
            <button
              key={area.id}
              type="button"
              onClick={() => setSelectedAreaId(area.id)}
              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
                selectedAreaId === area.id ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: area.color ?? "oklch(0.58 0.08 240)" }}
              />
              {area.name}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleMove}>Move</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
