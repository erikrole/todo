"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface TaskCheckboxProps {
  checked: boolean;
  onComplete: () => void;
  onUncomplete?: () => void;
  disabled?: boolean;
  tint?: string;
  isFlagged?: boolean;
}

export function TaskCheckbox({ checked, onComplete, onUncomplete, disabled, tint, isFlagged }: TaskCheckboxProps) {
  const [animating, setAnimating] = useState(false);
  const [hovered, setHovered] = useState(false);

  function handleClick() {
    if (disabled || animating) return;
    if (checked) {
      onUncomplete?.();
      return;
    }
    setAnimating(true);
    setTimeout(() => {
      onComplete();
    }, 350);
  }

  const filled = checked || animating;

  // Color hierarchy: flagged → tint → accent
  const accentColor = isFlagged
    ? "var(--danger)"
    : tint ?? "var(--accent)";

  // Outline stroke: tint or flagged always-on; plain gray when no tint and not hovered
  const hasTint = isFlagged || !!tint;
  const outlineStroke = hasTint || hovered ? accentColor : "oklch(0.72 0.010 78)";
  const outlineOpacity = hasTint ? 1 : hovered ? 0.85 : 0.45;

  // Subtle inner fill when tinted (matches the screenshot style)
  const innerFill = hasTint && !filled
    ? `color-mix(in oklch, ${accentColor} 14%, transparent)`
    : "transparent";

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      aria-label={checked ? "Mark incomplete" : "Mark complete"}
      className={cn(
        "relative flex items-center justify-center h-[18px] w-[18px] shrink-0 disabled:pointer-events-none active:scale-[0.8] transition-transform",
        animating && "[animation:task-complete_0.35s_ease-in-out]",
      )}
    >
      {animating && (
        <span
          className="absolute inset-0 pointer-events-none [animation:ripple-out_0.45s_ease-out_forwards]"
          style={{ borderRadius: 5, background: `color-mix(in oklch, ${accentColor} 20%, transparent)` }}
        />
      )}
      <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
        {/* Inner tint fill — always visible when project/flag tint is set */}
        {!filled && (
          <rect x="3.5" y="3.5" width="11" height="11" rx="2.5" ry="2.5" fill={innerFill} />
        )}
        {/* Outline square — visible when unchecked */}
        <rect
          x="1.75" y="1.75" width="14.5" height="14.5" rx="4" ry="4"
          strokeWidth="1.5"
          fill="none"
          stroke={outlineStroke}
          style={{ opacity: filled ? 0 : outlineOpacity, transition: "opacity 150ms, stroke 150ms" }}
        />
        {/* Filled square — appears on complete */}
        <rect
          x="1.75" y="1.75" width="14.5" height="14.5" rx="4" ry="4"
          fill={accentColor}
          style={{ opacity: filled ? 1 : 0, transition: "opacity 300ms ease-out" }}
        />
        {/* Checkmark */}
        <path
          d="M5.75 9.25L7.75 11.25L12.25 6.75"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          stroke="white"
          style={{ opacity: filled ? 1 : 0, transition: "opacity 200ms 150ms" }}
        />
      </svg>
    </button>
  );
}
