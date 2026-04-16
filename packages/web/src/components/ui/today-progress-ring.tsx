"use client";

interface TodayProgressRingProps {
  completed: number;
  total: number;
  remaining: number;
}

export function TodayProgressRing({ completed, total, remaining }: TodayProgressRingProps) {
  const progress = total > 0 ? completed / total : 0;
  const r = 5.5;
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
      <svg width="14" height="14" viewBox="0 0 14 14" style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle cx="7" cy="7" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.12} />
        {/* Progress */}
        <circle
          cx="7"
          cy="7"
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.4s ease, stroke 0.4s ease" }}
        />
      </svg>
      {remaining > 0 && (
        <span className="text-[11px] tabular-nums text-muted-foreground/50">{remaining}</span>
      )}
    </span>
  );
}
