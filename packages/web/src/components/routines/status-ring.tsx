interface StatusRingProps {
  /** 0–100, how far through the cycle */
  progressPct: number;
  isOverdue: boolean;
  isDueSoon: boolean;
}

export function StatusRing({ progressPct, isOverdue, isDueSoon }: StatusRingProps) {
  const r = 5;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * Math.min(progressPct / 100, 1);

  const trackColor = isOverdue
    ? "oklch(0.577 0.245 27.325 / 0.15)"
    : isDueSoon
      ? "oklch(0.65 0.18 75 / 0.18)"
      : "oklch(0.55 0 0 / 0.10)";

  const fillColor = isOverdue
    ? "oklch(0.577 0.245 27.325 / 0.75)"
    : isDueSoon
      ? "oklch(0.65 0.18 75 / 0.75)"
      : "oklch(0.52 0.15 165 / 0.60)";

  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      className="shrink-0 mt-px"
      style={{ transform: "rotate(-90deg)" }}
    >
      <circle cx="6.5" cy="6.5" r={r} fill="none" stroke={trackColor} strokeWidth="2" />
      <circle
        cx="6.5"
        cy="6.5"
        r={r}
        fill="none"
        stroke={fillColor}
        strokeWidth="2"
        strokeDasharray={`${filled} ${circumference}`}
        strokeLinecap="round"
      />
    </svg>
  );
}
