"use client";

interface TodayProgressRingProps {
  completed: number;
  total: number;
  remaining: number;
}

export function TodayProgressRing({ completed, total, remaining }: TodayProgressRingProps) {
  const progress = total > 0 ? completed / total : 0;
  const r = 6;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * progress;
  // Hue: 20 (red) → 142 (green) based on progress
  const hue = Math.round(20 + 122 * progress);
  const strokeColor = total === 0 ? "oklch(0.55 0 0)" : `oklch(0.58 0.18 ${hue})`;

  if (total === 0) {
    // No today tasks — show nothing
    return null;
  }

  return (
    <span className="flex items-center gap-1.5 shrink-0">
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle cx="8" cy="8" r={r} fill="none" stroke="currentColor" strokeWidth="2" opacity={0.15} />
        {/* Progress */}
        <circle
          cx="8"
          cy="8"
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.4s ease, stroke 0.4s ease" }}
        />
      </svg>
      {remaining > 0 && (
        <span className="text-xs tabular-nums text-muted-foreground/60">{remaining}</span>
      )}
    </span>
  );
}
