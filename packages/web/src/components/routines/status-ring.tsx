interface StatusRingProps {
  progressPct: number;
  isOverdue: boolean;
  isDueSoon: boolean;
}

export function StatusRing({ progressPct, isOverdue, isDueSoon }: StatusRingProps) {
  const r = 9;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * Math.min(progressPct / 100, 1);

  const trackColor = isOverdue
    ? "oklch(0.577 0.245 27.325 / 0.20)"
    : isDueSoon
      ? "oklch(0.65 0.18 75 / 0.22)"
      : "oklch(0.55 0 0 / 0.15)";

  const fillColor = isOverdue
    ? "oklch(0.577 0.245 27.325 / 0.90)"
    : isDueSoon
      ? "oklch(0.65 0.18 75 / 0.90)"
      : "oklch(0.52 0.18 165 / 0.82)";

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className="shrink-0"
      style={{ transform: "rotate(-90deg)" }}
    >
      <circle cx="12" cy="12" r={r} fill="none" stroke={trackColor} strokeWidth="2.5" />
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke={fillColor}
        strokeWidth="2.5"
        strokeDasharray={`${filled} ${circumference}`}
        strokeLinecap="round"
      />
    </svg>
  );
}
