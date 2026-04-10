"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface DroppableZoneProps {
  id: string;
  className?: string;
  children: React.ReactNode;
}

export function DroppableZone({ id, className, children }: DroppableZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg transition-colors duration-150",
        isOver && "bg-primary/5 ring-1 ring-inset ring-primary/20",
        className,
      )}
    >
      {children}
    </div>
  );
}
