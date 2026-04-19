"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRoutines, useUpdateRoutine, useDeleteRoutine, useCreateRoutine, type Routine } from "@/hooks/use-routines";
import { useAreas } from "@/hooks/use-areas";
import { useInsights } from "@/hooks/use-insights";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoutineItem } from "@/components/routines/routine-item";
import { api } from "@/lib/fetch";
import { LINKED_ROUTINE_TITLES } from "@/lib/routine-links";
import { Plus } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr + "T00:00:00").getTime() - today.getTime()) / 86400000);
}

function daysSince(dateStr: string): number {
  return -daysUntil(dateStr);
}

function dueLabel(days: number): string {
  if (days < -1) return `${Math.abs(days)}d overdue`;
  if (days === -1) return "yesterday";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}

function dueColor(days: number): string {
  if (days < 0) return "oklch(58% 0.22 25)";
  if (days === 0) return "oklch(55% 0.18 140)";
  if (days <= 2) return "oklch(65% 0.17 75)";
  return "var(--ink-4)";
}

function lastLabel(lastAt: string | null): string {
  if (!lastAt) return "never done";
  const d = daysSince(lastAt);
  if (d === 0) return "last today";
  if (d === 1) return "last yesterday";
  return `last ${d}d ago`;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function freqLabel(r: Routine): string {
  const type = r.recurrenceType;
  const interval = r.recurrenceInterval ?? 1;
  if (!type) return "";
  if (type === "appointment") {
    return r.whenDate ? `next: ${new Date(r.whenDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "appointment";
  }
  if (type === "weekday") return `every ${WEEKDAY_NAMES[interval % 7] ?? "week"}`;
  if (type === "yearly" || type === "year") {
    if (r.whenDate) {
      const month = new Date(r.whenDate + "T00:00:00").toLocaleString("default", { month: "long" });
      return `every ${month}`;
    }
    return interval === 1 ? "annually" : `every ${interval} years`;
  }
  if (type === "daily" || type === "day") return interval === 1 ? "daily" : `every ${interval} days`;
  if (type === "weekly" || type === "week") return interval === 1 ? "weekly" : `every ${interval} weeks`;
  if (type === "monthly" || type === "month") return interval === 1 ? "monthly" : `every ${interval} months`;
  return type;
}

const LINKED_LOGS: Record<string, string> = {
  "Mow Lawn": "/logs/mowing?add=1",
  "Oil Change": "/logs/maintenance?add=1&type=oil_change",
  "Doctor Visit": "/logs/health?add=1&type=doctor",
  "Eye Exam": "/logs/health?add=1&type=eye_exam",
  "Dentist": "/logs/health?add=1&type=dental",
};

// ── Edit dialog ───────────────────────────────────────────────────────────────

type RoutineModeTop = "interval" | "appointment" | "annual";
type IntervalVariant = "schedule" | "weekday";
type IntervalUnit = "days" | "weeks" | "months" | "years";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const UNIT_MAP: Record<string, IntervalUnit> = {
  daily: "days", day: "days",
  weekly: "weeks", week: "weeks",
  monthly: "months", month: "months",
  yearly: "years", year: "years",
};

const UNIT_TO_TYPE: Record<IntervalUnit, string> = {
  days: "daily", weeks: "weekly", months: "monthly", years: "yearly",
};

interface RoutineForm {
  title: string;
  topMode: RoutineModeTop;
  intervalVariant: IntervalVariant;
  intervalValue: number;
  intervalUnit: IntervalUnit;
  weekday: number;
  annualMonth: number; // 0-based (0 = Jan)
  whenDate: string;
  areaId: string;
  notes: string;
}

function nextOccurrenceOfMonth(month0: number): string {
  const now = new Date();
  let year = now.getFullYear();
  if (month0 <= now.getMonth()) year += 1;
  return `${year}-${String(month0 + 1).padStart(2, "0")}-01`;
}

function routineToForm(r: Routine): RoutineForm {
  const type = r.recurrenceType ?? "";
  const isWeekday = type === "weekday";
  const isAppointment = type === "appointment";
  const isAnnual = (type === "yearly" || type === "year") && (r.recurrenceInterval ?? 1) === 1;

  let topMode: RoutineModeTop = "interval";
  if (isAppointment) topMode = "appointment";
  else if (isAnnual) topMode = "annual";

  const annualMonth = r.whenDate
    ? new Date(r.whenDate + "T00:00:00").getMonth()
    : new Date().getMonth();

  return {
    title: r.title,
    topMode,
    intervalVariant: isWeekday ? "weekday" : "schedule",
    intervalValue: (!isWeekday && !isAppointment && !isAnnual) ? (r.recurrenceInterval ?? 1) : 1,
    intervalUnit: UNIT_MAP[type] ?? "weeks",
    weekday: isWeekday ? (r.recurrenceInterval ?? 1) : 1,
    annualMonth,
    whenDate: r.whenDate ?? "",
    areaId: r.areaId ?? "",
    notes: r.notes ?? "",
  };
}

function freqLabelFromForm(form: RoutineForm): string {
  if (form.topMode === "appointment") return "Manually schedule after each completion";
  if (form.topMode === "annual") return `Every ${MONTH_NAMES[form.annualMonth]}`;
  if (form.intervalVariant === "weekday") return `Every ${WEEKDAYS[form.weekday]}`;
  const n = form.intervalValue;
  const unit = form.intervalUnit;
  if (n === 1) return { days: "Daily", weeks: "Weekly", months: "Monthly", years: "Annually" }[unit];
  if (n === 2) return `Every other ${unit.slice(0, -1)}`;
  return `Every ${n} ${unit}`;
}

function RoutineEditDialog({
  open, onClose, routine,
}: { open: boolean; onClose: () => void; routine: Routine | null }) {
  const update = useUpdateRoutine();
  const del = useDeleteRoutine();
  const { data: areas = [] } = useAreas();
  const submittedRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<RoutineForm>({
    title: "", topMode: "interval", intervalVariant: "schedule",
    intervalValue: 1, intervalUnit: "weeks", weekday: 1,
    annualMonth: 0, whenDate: "", areaId: "", notes: "",
  });

  useEffect(() => {
    if (open && routine) {
      setForm(routineToForm(routine));
      setDeleting(false);
    }
  }, [open, routine?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof RoutineForm>(k: K, v: RoutineForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function stepInterval(delta: number) {
    setForm((f) => ({ ...f, intervalValue: Math.max(1, f.intervalValue + delta) }));
  }

  async function handleSave() {
    if (!routine || submittedRef.current || !form.title.trim()) return;
    submittedRef.current = true;
    try {
      let recurrenceType: string | null = null;
      let recurrenceInterval: number | null = null;
      let whenDate: string | null = form.whenDate || null;

      if (form.topMode === "appointment") {
        recurrenceType = "appointment";
        recurrenceInterval = null;
      } else if (form.topMode === "annual") {
        recurrenceType = "yearly";
        recurrenceInterval = 1;
        // Auto-set whenDate to next occurrence of selected month if not already in that month
        if (!whenDate) {
          whenDate = nextOccurrenceOfMonth(form.annualMonth);
        }
      } else {
        // interval mode
        if (form.intervalVariant === "weekday") {
          recurrenceType = "weekday";
          recurrenceInterval = form.weekday;
        } else {
          recurrenceType = UNIT_TO_TYPE[form.intervalUnit];
          recurrenceInterval = form.intervalValue;
        }
      }

      await update.mutateAsync({
        id: routine.id,
        title: form.title.trim(),
        recurrenceType,
        recurrenceInterval,
        whenDate,
        areaId: form.areaId || null,
        notes: form.notes.trim() || null,
      });
      onClose();
    } finally { submittedRef.current = false; }
  }

  async function handleDelete() {
    if (!routine || submittedRef.current) return;
    submittedRef.current = true;
    try { await del.mutateAsync(routine.id); onClose(); }
    finally { submittedRef.current = false; }
  }

  const busy = update.isPending || del.isPending;

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 13px", borderRadius: 100, fontSize: 12,
    fontWeight: active ? 600 : 400, cursor: "pointer",
    border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
    background: active ? "color-mix(in oklch, var(--primary) 10%, transparent)" : "transparent",
    color: active ? "var(--primary)" : "var(--muted-foreground)",
    transition: "all 0.1s",
  });

  const topModes: { key: RoutineModeTop; label: string }[] = [
    { key: "interval", label: "Interval" },
    { key: "appointment", label: "Appointment" },
    { key: "annual", label: "Annual" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit routine</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus />
          </div>

          {/* Top-level mode */}
          <div className="flex flex-col gap-2">
            <Label>Schedule type</Label>
            <div style={{ display: "flex", gap: 6 }}>
              {topModes.map(({ key, label }) => (
                <button key={key} type="button" onClick={() => set("topMode", key)} style={pillStyle(form.topMode === key)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Interval mode */}
          {form.topMode === "interval" && (
            <>
              <div className="flex flex-col gap-2">
                <div style={{ display: "flex", gap: 6 }}>
                  {(["schedule", "weekday"] as IntervalVariant[]).map((v) => (
                    <button key={v} type="button" onClick={() => set("intervalVariant", v)} style={{ ...pillStyle(form.intervalVariant === v), fontSize: 11 }}>
                      {v === "schedule" ? "Every N…" : "Day of week"}
                    </button>
                  ))}
                </div>
              </div>

              {form.intervalVariant === "schedule" && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                    <button type="button" onClick={() => stepInterval(-1)} disabled={form.intervalValue <= 1}
                      style={{ width: 32, height: 36, fontSize: 16, cursor: form.intervalValue > 1 ? "pointer" : "default", color: form.intervalValue > 1 ? "var(--foreground)" : "var(--muted-foreground)", background: "transparent", border: "none" }}>−</button>
                    <span style={{ minWidth: 28, textAlign: "center", fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{form.intervalValue}</span>
                    <button type="button" onClick={() => stepInterval(1)}
                      style={{ width: 32, height: 36, fontSize: 16, cursor: "pointer", background: "transparent", border: "none", color: "var(--foreground)" }}>+</button>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {(["days", "weeks", "months", "years"] as IntervalUnit[]).map((u) => (
                      <button key={u} type="button" onClick={() => set("intervalUnit", u)} style={pillStyle(form.intervalUnit === u)}>
                        {form.intervalValue === 1 ? u.slice(0, -1) : u}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {form.intervalVariant === "weekday" && (
                <div style={{ display: "flex", gap: 5 }}>
                  {WEEKDAYS.map((day, i) => (
                    <button key={i} type="button" onClick={() => set("weekday", i)}
                      style={{ ...pillStyle(form.weekday === i), padding: "5px 8px", flex: 1, textAlign: "center" }}>
                      {day}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Appointment mode */}
          {form.topMode === "appointment" && (
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
              No automatic schedule. After each completion, you&apos;ll be prompted to set the next appointment — with a smart suggestion.
            </p>
          )}

          {/* Annual mode */}
          {form.topMode === "annual" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {MONTH_NAMES.map((m, i) => (
                <button key={i} type="button" onClick={() => {
                  set("annualMonth", i);
                  // Auto-update whenDate when month changes
                  setForm((f) => ({ ...f, annualMonth: i, whenDate: nextOccurrenceOfMonth(i) }));
                }}
                  style={{ ...pillStyle(form.annualMonth === i), padding: "5px 10px" }}>
                  {m}
                </button>
              ))}
            </div>
          )}

          {/* Preview */}
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "-8px 0 0" }}>
            {freqLabelFromForm(form)}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{form.topMode === "appointment" ? "Next appointment" : "Next due"}</Label>
              <Input type="date" value={form.whenDate} onChange={(e) => set("whenDate", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Area</Label>
              <select
                value={form.areaId}
                onChange={(e) => set("areaId", e.target.value)}
                style={{
                  height: 36, borderRadius: 6, border: "1px solid var(--border)",
                  background: "var(--background)", color: "var(--foreground)",
                  fontSize: 14, padding: "0 8px", width: "100%",
                }}
              >
                <option value="">None</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Input placeholder="Optional" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {!deleting && <Button variant="destructive" onClick={() => setDeleting(true)} disabled={busy} className="sm:mr-auto">Delete</Button>}
          {deleting && <Button variant="destructive" onClick={handleDelete} disabled={busy} className="sm:mr-auto">Confirm delete</Button>}
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSave} disabled={busy || !form.title.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create dialog ─────────────────────────────────────────────────────────────

function RoutineCreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateRoutine();
  const { data: areas = [] } = useAreas();
  const submittedRef = useRef(false);
  const [form, setForm] = useState<RoutineForm>({
    title: "", topMode: "interval", intervalVariant: "schedule",
    intervalValue: 1, intervalUnit: "weeks", weekday: 1,
    annualMonth: 0, whenDate: "", areaId: "", notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({ title: "", topMode: "interval", intervalVariant: "schedule", intervalValue: 1, intervalUnit: "weeks", weekday: 1, annualMonth: 0, whenDate: "", areaId: "", notes: "" });
    }
  }, [open]);

  function set<K extends keyof RoutineForm>(k: K, v: RoutineForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function stepInterval(delta: number) {
    setForm((f) => ({ ...f, intervalValue: Math.max(1, f.intervalValue + delta) }));
  }

  async function handleSave() {
    if (submittedRef.current || !form.title.trim()) return;
    submittedRef.current = true;
    try {
      let recurrenceType: string | null = null;
      let recurrenceInterval: number | null = null;
      let whenDate: string | null = form.whenDate || null;

      if (form.topMode === "appointment") {
        recurrenceType = "appointment";
        recurrenceInterval = null;
      } else if (form.topMode === "annual") {
        recurrenceType = "yearly";
        recurrenceInterval = 1;
        if (!whenDate) whenDate = nextOccurrenceOfMonth(form.annualMonth);
      } else {
        if (form.intervalVariant === "weekday") {
          recurrenceType = "weekday";
          recurrenceInterval = form.weekday;
        } else {
          recurrenceType = UNIT_TO_TYPE[form.intervalUnit];
          recurrenceInterval = form.intervalValue;
        }
      }

      await create.mutateAsync({
        title: form.title.trim(),
        recurrenceType,
        recurrenceInterval,
        whenDate,
        areaId: form.areaId || null,
        notes: form.notes.trim() || null,
      });
      onClose();
    } finally { submittedRef.current = false; }
  }

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 13px", borderRadius: 100, fontSize: 12,
    fontWeight: active ? 600 : 400, cursor: "pointer",
    border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
    background: active ? "color-mix(in oklch, var(--primary) 10%, transparent)" : "transparent",
    color: active ? "var(--primary)" : "var(--muted-foreground)",
    transition: "all 0.1s",
  });

  const topModes: { key: RoutineModeTop; label: string }[] = [
    { key: "interval", label: "Interval" },
    { key: "appointment", label: "Appointment" },
    { key: "annual", label: "Annual" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New routine</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              placeholder="e.g. Gym, Vitamins, Water plants…"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Schedule type</Label>
            <div style={{ display: "flex", gap: 6 }}>
              {topModes.map(({ key, label }) => (
                <button key={key} type="button" onClick={() => set("topMode", key)} style={pillStyle(form.topMode === key)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {form.topMode === "interval" && (
            <>
              <div className="flex flex-col gap-2">
                <div style={{ display: "flex", gap: 6 }}>
                  {(["schedule", "weekday"] as IntervalVariant[]).map((v) => (
                    <button key={v} type="button" onClick={() => set("intervalVariant", v)} style={{ ...pillStyle(form.intervalVariant === v), fontSize: 11 }}>
                      {v === "schedule" ? "Every N…" : "Day of week"}
                    </button>
                  ))}
                </div>
              </div>

              {form.intervalVariant === "schedule" && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                    <button type="button" onClick={() => stepInterval(-1)} disabled={form.intervalValue <= 1}
                      style={{ width: 32, height: 36, fontSize: 16, cursor: form.intervalValue > 1 ? "pointer" : "default", color: form.intervalValue > 1 ? "var(--foreground)" : "var(--muted-foreground)", background: "transparent", border: "none" }}>−</button>
                    <span style={{ minWidth: 28, textAlign: "center", fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{form.intervalValue}</span>
                    <button type="button" onClick={() => stepInterval(1)}
                      style={{ width: 32, height: 36, fontSize: 16, cursor: "pointer", background: "transparent", border: "none", color: "var(--foreground)" }}>+</button>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {(["days", "weeks", "months", "years"] as IntervalUnit[]).map((u) => (
                      <button key={u} type="button" onClick={() => set("intervalUnit", u)} style={pillStyle(form.intervalUnit === u)}>
                        {form.intervalValue === 1 ? u.slice(0, -1) : u}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {form.intervalVariant === "weekday" && (
                <div style={{ display: "flex", gap: 5 }}>
                  {WEEKDAYS.map((day, i) => (
                    <button key={i} type="button" onClick={() => set("weekday", i)}
                      style={{ ...pillStyle(form.weekday === i), padding: "5px 8px", flex: 1, textAlign: "center" }}>
                      {day}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {form.topMode === "appointment" && (
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
              No automatic schedule. After each completion, you&apos;ll be prompted to set the next appointment.
            </p>
          )}

          {form.topMode === "annual" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {MONTH_NAMES.map((m, i) => (
                <button key={i} type="button" onClick={() => {
                  setForm((f) => ({ ...f, annualMonth: i, whenDate: nextOccurrenceOfMonth(i) }));
                }}
                  style={{ ...pillStyle(form.annualMonth === i), padding: "5px 10px" }}>
                  {m}
                </button>
              ))}
            </div>
          )}

          <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "-8px 0 0" }}>
            {freqLabelFromForm(form)}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{form.topMode === "appointment" ? "First appointment" : "First due"}</Label>
              <Input type="date" value={form.whenDate} onChange={(e) => set("whenDate", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Area</Label>
              <select
                value={form.areaId}
                onChange={(e) => set("areaId", e.target.value)}
                style={{
                  height: 36, borderRadius: 6, border: "1px solid var(--border)",
                  background: "var(--background)", color: "var(--foreground)",
                  fontSize: 14, padding: "0 8px", width: "100%",
                }}
              >
                <option value="">None</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Input placeholder="Optional" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={create.isPending || !form.title.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Countdown view ────────────────────────────────────────────────────────────

function countdownColor(days: number): string {
  if (days < 0) return "oklch(58% 0.22 25)";
  if (days === 0) return "oklch(55% 0.18 140)";
  if (days <= 2) return "oklch(62% 0.16 75)";
  return "var(--ink-3)";
}

function countdownBg(days: number): string {
  if (days < 0) return "color-mix(in oklch, oklch(58% 0.22 25) 8%, var(--surface))";
  if (days === 0) return "color-mix(in oklch, oklch(55% 0.18 140) 8%, var(--surface))";
  if (days <= 2) return "color-mix(in oklch, oklch(62% 0.16 75) 6%, var(--surface))";
  return "var(--surface)";
}

interface CountdownGroup {
  name: string;
  color: string | null;
  routines: Routine[];
}

function CountdownCard({ r, today, onEdit }: { r: Routine; today: string; onEdit: (r: Routine) => void }) {
  const days = r.whenDate ? daysUntil(r.whenDate) : null;
  const color = days !== null ? countdownColor(days) : "var(--ink-4)";
  const bg = days !== null ? countdownBg(days) : "var(--surface)";

  let bigLabel: string;
  let subLabel: string;
  if (days === null) {
    bigLabel = "—";
    subLabel = "no date set";
  } else if (days < 0) {
    bigLabel = String(Math.abs(days));
    subLabel = `day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  } else if (days === 0) {
    bigLabel = "today";
    subLabel = "due now";
  } else if (days === 1) {
    bigLabel = "1";
    subLabel = "day left";
  } else {
    bigLabel = String(days);
    subLabel = "days left";
  }

  return (
    <button
      onClick={() => onEdit(r)}
      style={{
        display: "flex", flexDirection: "column", alignItems: "flex-start",
        padding: "14px 16px", borderRadius: 12, border: "1px solid var(--hairline)",
        background: bg, cursor: "pointer", textAlign: "left", gap: 2,
        transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--hairline)"; e.currentTarget.style.background = bg; }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span style={{ fontSize: days === 0 ? 20 : 32, fontWeight: 700, color, lineHeight: 1, fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-display)" }}>
          {bigLabel}
        </span>
        {days !== 0 && days !== null && (
          <span style={{ fontSize: 11, color, opacity: 0.75, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {subLabel}
          </span>
        )}
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3, marginTop: 4 }}>
        {r.title}
      </span>
      <span style={{ fontSize: 11, color: "var(--ink-4)" }}>
        {freqLabel(r)}
        {r.lastCompletedAt ? ` · ${lastLabel(r.lastCompletedAt)}` : ""}
      </span>
    </button>
  );
}

function CountdownView({ groups, today, onEdit }: { groups: CountdownGroup[]; today: string; onEdit: (r: Routine) => void }) {
  return (
    <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 28 }}>
      {groups.map((group) => (
        <div key={group.name}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            {group.color && (
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: group.color, flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{group.name}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {group.routines
              .slice()
              .sort((a, b) => {
                if (!a.whenDate && !b.whenDate) return 0;
                if (!a.whenDate) return 1;
                if (!b.whenDate) return -1;
                return a.whenDate.localeCompare(b.whenDate);
              })
              .map((r) => (
                <CountdownCard key={r.id} r={r} today={today} onEdit={onEdit} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Insights card ─────────────────────────────────────────────────────────────

function InsightsCard({ hasNullDates }: { hasNullDates: boolean }) {
  const { data: insights = [], refetch } = useInsights();
  const [syncing, setSyncing] = useState(false);
  const hasAlerts = insights.some((i) => i.severity === "alert");
  const hasWarnings = insights.some((i) => i.severity === "warning");

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      await api.post("/api/routines/sync-dates", {});
      await refetch();
    } finally { setSyncing(false); }
  }

  if (insights.length === 0 && !hasNullDates) return null;

  return (
    <div style={{
      margin: "0 20px 16px", padding: "12px 14px", borderRadius: 12,
      border: `1px solid ${hasAlerts ? "oklch(58% 0.22 25 / 30%)" : hasWarnings ? "oklch(65% 0.17 75 / 30%)" : "var(--hairline)"}`,
      background: hasAlerts ? "color-mix(in oklch, oklch(58% 0.22 25) 5%, var(--surface))" : hasWarnings ? "color-mix(in oklch, oklch(65% 0.17 75) 5%, var(--surface))" : "var(--surface)",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {insights.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {insights.map((insight) => (
            <div key={insight.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{insight.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: insight.severity === "alert" ? "oklch(58% 0.22 25)" : insight.severity === "warning" ? "oklch(55% 0.16 75)" : "var(--ink)" }}>
                {insight.title}
              </span>
              <span style={{ fontSize: 12, color: "var(--ink-4)" }}>{insight.detail}</span>
            </div>
          ))}
        </div>
      )}
      {hasNullDates && (
        <button onClick={handleSync} disabled={syncing} style={{
          alignSelf: "flex-start", fontSize: 12, fontWeight: 500, color: "var(--primary)",
          padding: "4px 10px", borderRadius: 6, border: "1px solid var(--primary)",
          background: "transparent", cursor: syncing ? "default" : "pointer", opacity: syncing ? 0.6 : 1,
        }}>
          {syncing ? "Syncing…" : "Sync due dates"}
        </button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ViewMode = "area" | "due" | "countdown";

const VIEW_STORAGE_KEY = "routines-view";

export default function V2RoutinesPage() {
  const { data: routines = [], isLoading } = useRoutines();
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "area" || saved === "due" || saved === "countdown") return saved;
    }
    return "area";
  });
  const [editing, setEditing] = useState<Routine | null>(null);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const today = todayStr();
  const hasNullDates = routines.some((r) => !r.whenDate && r.recurrenceType && r.recurrenceType !== "appointment" && r.recurrenceInterval);

  function renderRoutineCard(r: Routine, index: number) {
    const logPath = LINKED_LOGS[r.title];
    return (
      <RoutineItem
        key={r.id}
        task={r as unknown as import("@todo/shared").Task}
        index={index}
        onEdit={() => setEditing(r)}
        onRowClick={logPath ? () => router.push(logPath) : undefined}
      />
    );
  }

  const dueToday = useMemo(() => routines.filter((r) => r.whenDate && r.whenDate <= today), [routines, today]);

  const byArea = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null; routines: Routine[] }>();
    const noArea: Routine[] = [];
    for (const r of routines) {
      if (!r.areaId) { noArea.push(r); continue; }
      if (!map.has(r.areaId)) map.set(r.areaId, { name: r.areaName ?? r.areaId, color: r.areaColor, routines: [] });
      map.get(r.areaId)!.routines.push(r);
    }
    const groups = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    if (noArea.length > 0) groups.push({ name: "Other", color: null, routines: noArea });
    return groups;
  }, [routines]);

  const byDue = useMemo(() => {
    return [...routines].sort((a, b) => {
      if (!a.whenDate && !b.whenDate) return a.title.localeCompare(b.title);
      if (!a.whenDate) return 1;
      if (!b.whenDate) return -1;
      return a.whenDate.localeCompare(b.whenDate);
    });
  }, [routines]);

  const areaNames = [...new Set(routines.filter((r) => r.areaName).map((r) => r.areaName!))];

  return (
    <>
      <div style={{ maxWidth: 1100 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "32px 20px 20px" }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 30, letterSpacing: "-0.02em", color: "var(--ink)", margin: "0 0 4px" }}>
              Routines
            </h1>
            {routines.length > 0 && (
              <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>
                {routines.length} tracked
                {areaNames.length > 0 ? ` · across ${areaNames.join(", ")}` : ""}
                {dueToday.length > 0 ? ` · ${dueToday.length} due today` : ""}
              </p>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {routines.length > 0 && (
              <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", fontSize: 12, fontWeight: 500 }}>
                {(["area", "due", "countdown"] as ViewMode[]).map((v) => (
                  <button key={v} onClick={() => { setView(v); localStorage.setItem(VIEW_STORAGE_KEY, v); }} style={{
                    padding: "6px 14px", cursor: "pointer", border: "none",
                    background: view === v ? "var(--primary)" : "transparent",
                    color: view === v ? "var(--primary-foreground)" : "var(--muted-foreground)",
                    transition: "background 0.15s, color 0.15s",
                  }}>
                    {v === "area" ? "By area" : v === "due" ? "All by due" : "Countdown"}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setCreating(true)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)",
                background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 500,
                color: "var(--muted-foreground)", transition: "color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--foreground)"; e.currentTarget.style.borderColor = "var(--foreground)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted-foreground)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <Plus size={13} />
              New routine
            </button>
          </div>
        </div>

        {!isLoading && routines.length > 0 && (
          <InsightsCard hasNullDates={hasNullDates} />
        )}

        {isLoading ? (
          <div style={{ padding: "0 20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: 110, borderRadius: 12, background: "var(--surface)", opacity: 0.5 }} />
            ))}
          </div>
        ) : routines.length === 0 ? (
          <div style={{ padding: "64px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>
              No routines yet.{" "}
              <button onClick={() => setCreating(true)} style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, padding: 0 }}>
                Create your first one.
              </button>
            </p>
          </div>
        ) : view === "area" ? (
          <div style={{ padding: "0 20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24, alignItems: "start" }}>
            {byArea.map((group) => (
              <div key={group.name} style={{ display: "flex", flexDirection: "column", maxHeight: "calc(100dvh - 180px)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexShrink: 0 }}>
                  {group.color && (
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: group.color, flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{group.name}</span>
                  <span style={{ fontSize: 12, color: "var(--ink-4)" }}>{group.routines.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", paddingBottom: 8 }}>
                  {group.routines.map((r, i) => renderRoutineCard(r, i))}
                </div>
              </div>
            ))}
          </div>
        ) : view === "due" ? (
          <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 6, maxWidth: 480 }}>
            {byDue.map((r, i) => renderRoutineCard(r, i))}
          </div>
        ) : (
          <CountdownView groups={byArea} today={today} onEdit={setEditing} />
        )}

        <RoutineEditDialog open={!!editing} onClose={() => setEditing(null)} routine={editing} />
        <RoutineCreateDialog open={creating} onClose={() => setCreating(false)} />
      </div>
    </>
  );
}
