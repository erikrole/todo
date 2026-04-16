"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface TaskCheckboxProps {
  checked: boolean;
  onComplete: () => void;
  onUncomplete?: () => void;
  disabled?: boolean;
}

export function TaskCheckbox({ checked, onComplete, onUncomplete, disabled }: TaskCheckboxProps) {
  const [animating, setAnimating] = useState(false);

  function handleClick() {
    if (disabled || animating) return;
    if (checked) {
      onUncomplete?.();
      return;
    }
    setAnimating(true);
    setTimeout(() => {
      onComplete();
      // Don't reset animating — the component re-renders from the optimistic update
      // which resets local state naturally.
    }, 350);
  }

  const filled = checked || animating;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={checked ? "Mark incomplete" : "Mark complete"}
      className={cn(
        "group relative flex items-center justify-center h-[18px] w-[18px] shrink-0 rounded-full disabled:pointer-events-none active:scale-[0.8] transition-transform",
        animating && "[animation:task-complete_0.35s_ease-in-out]",
      )}
    >
      {animating && (
        <span className="absolute inset-0 rounded-full bg-primary/25 [animation:ripple-out_0.45s_ease-out_forwards] pointer-events-none" />
      )}
      <svg viewBox="0 0 18 18" fill="none" className="h-[18px] w-[18px]">
        {/* Hollow outline — visible when unchecked */}
        <circle
          cx="9"
          cy="9"
          r="7.25"
          strokeWidth="1.5"
          className={cn(
            "fill-none transition-[stroke,opacity] duration-150",
            filled
              ? "opacity-0 stroke-primary"
              : "stroke-foreground/20 group-hover:stroke-primary/55",
          )}
        />
        {/* Filled circle — fades in when completing/completed */}
        <circle
          cx="9"
          cy="9"
          r="7.25"
          strokeWidth="0"
          className={cn(
            "fill-primary transition-opacity duration-300 ease-out",
            filled ? "opacity-100" : "opacity-0",
          )}
        />
        {/* Checkmark — appears after fill */}
        <path
          d="M5.75 9.25L7.75 11.25L12.25 6.75"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "stroke-primary-foreground transition-opacity duration-200",
            filled ? "opacity-100 delay-150" : "opacity-0",
          )}
        />
      </svg>
    </button>
  );
}
