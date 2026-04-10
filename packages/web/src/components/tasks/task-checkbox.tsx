"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface TaskCheckboxProps {
  checked: boolean;
  onComplete: () => void;
  disabled?: boolean;
}

export function TaskCheckbox({ checked, onComplete, disabled }: TaskCheckboxProps) {
  const [animating, setAnimating] = useState(false);

  function handleCheckedChange(value: boolean) {
    // One-way only: can only check, not uncheck. Completion is handled by the API.
    if (!value || checked || disabled || animating) return;
    setAnimating(true);
    setTimeout(() => {
      onComplete();
      setAnimating(false);
    }, 320);
  }

  return (
    <Checkbox
      checked={checked || animating}
      onCheckedChange={handleCheckedChange}
      disabled={disabled || checked}
      aria-label={checked ? "Completed" : "Mark complete"}
      className={cn(
        "transition-all duration-150",
        animating && "opacity-70",
      )}
    />
  );
}
