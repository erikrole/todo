import { Progress } from "@/components/ui/progress";

interface TodayProgressProps {
  completed: number;
  total: number;
}

function progressColor(pct: number): string {
  // Interpolate hsl(0, 80%, 50%) at 0% → hsl(120, 60%, 45%) at 100%
  const h = Math.round(pct * 1.2);
  const s = Math.round(80 - pct * 0.2);
  const l = Math.round(50 - pct * 0.05);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function TodayProgress({ completed, total }: TodayProgressProps) {
  if (total === 0) return null;
  const pct = Math.min((completed / total) * 100, 100);

  return (
    <div className="flex items-center gap-3 px-4">
      <Progress
        value={pct}
        className="h-1.5 flex-1"
        indicatorStyle={{ backgroundColor: progressColor(pct), transition: "background-color 0.5s ease, transform 0.5s ease" }}
      />
      <span className="text-xs text-muted-foreground/65 shrink-0 tabular-nums">
        {completed}/{total}
      </span>
    </div>
  );
}
