"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface TaskCheckboxProps {
  checked: boolean;
  onComplete: () => void;
  disabled?: boolean;
}

export function TaskCheckbox({ checked, onComplete, disabled }: TaskCheckboxProps) {
  const [animating, setAnimating] = useState(false);

  function handleClick() {
    if (checked || disabled || animating) return;
    setAnimating(true);
    setTimeout(() => {
      onComplete();
      setAnimating(false);
    }, 400);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={checked ? "Completed" : "Mark complete"}
      className={cn(
        "h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
        checked
          ? "border-primary bg-primary"
          : "border-muted-foreground/40 hover:border-primary",
        animating && "border-primary",
      )}
    >
      <AnimatePresence>
        {(checked || animating) && (
          <motion.svg
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-3 w-3 text-primary-foreground"
            fill="none"
            viewBox="0 0 12 12"
          >
            <path
              d="M2 6l3 3 5-5"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </button>
  );
}
