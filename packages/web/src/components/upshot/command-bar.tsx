"use client";

import { useState, useEffect } from "react";

const HINTS = [
  "Remind me to water plants every 3 days",
  "What's on my plate tomorrow?",
  "Snooze 'Rotate tires' until Saturday",
  "Add task for Monday morning",
];

export function CommandBar() {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [hintIdx, setHintIdx] = useState(0);

  useEffect(() => {
    if (focused || value) return;
    const t = setInterval(() => setHintIdx((i) => (i + 1) % HINTS.length), 2800);
    return () => clearInterval(t);
  }, [focused, value]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 22,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 30,
        width: "min(720px, calc(100vw - 280px))",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--hairline)",
          borderRadius: 14,
          boxShadow: "var(--shadow-2)",
          padding: "10px 12px 10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "var(--accent)",
            color: "white",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1l1.5 4.5H14l-3.75 2.75 1.5 4.5L8 10l-3.75 2.75 1.5-4.5L2 5.5h4.5z" />
          </svg>
        </div>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={focused ? "Type a task, or ask…" : HINTS[hintIdx]}
          style={{
            flex: 1,
            border: 0,
            outline: 0,
            background: "transparent",
            fontSize: 14,
            color: "var(--ink)",
            fontFamily: "var(--font-ui)",
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: "var(--ink-4)",
            padding: "2px 6px",
            border: "1px solid var(--hairline)",
            borderRadius: 5,
          }}
        >
          ⌘K
        </span>
      </div>
    </div>
  );
}
