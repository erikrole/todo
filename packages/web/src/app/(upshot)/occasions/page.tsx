"use client";

import { useState, useRef, useEffect } from "react";
import { useOccasions, useCreateOccasion, useUpdateOccasion, useDeleteOccasion } from "@/hooks/use-occasions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Occasion } from "@todo/db";
import type { OccasionType } from "@todo/shared";

// ── Types ────────────────────────────────────────────────────────────────────

const TYPE_META: Record<OccasionType, { label: string; emoji: string; color: string; alwaysAnnual: boolean; showPerson: boolean; showStartYear: boolean; startYearLabel: string }> = {
  birthday:    { label: "Birthday",     emoji: "🎂", color: "#ec4899", alwaysAnnual: true,  showPerson: true,  showStartYear: false, startYearLabel: "" },
  anniversary: { label: "Anniversary",  emoji: "💍", color: "#8b5cf6", alwaysAnnual: true,  showPerson: true,  showStartYear: false, startYearLabel: "" },
  sports:      { label: "Sports",       emoji: "🏟️", color: "#3b82f6", alwaysAnnual: false, showPerson: false, showStartYear: false, startYearLabel: "" },
  holiday:     { label: "Holiday",      emoji: "🎉", color: "#f59e0b", alwaysAnnual: true,  showPerson: false, showStartYear: false, startYearLabel: "" },
  event:       { label: "Special Event",emoji: "⭐", color: "#6b7280", alwaysAnnual: false, showPerson: false, showStartYear: false, startYearLabel: "" },
};

const TYPES = Object.keys(TYPE_META) as OccasionType[];

import { nextOccurrenceForOccasion, daysUntilDate, easterDate, nthWeekdayOfMonth, lastWeekdayOfMonth } from "@/lib/occasions";

// ── Countdown helpers ────────────────────────────────────────────────────────

function daysUntil(dateStr: string) {
  return daysUntilDate(dateStr);
}

function formatCountdown(days: number): string {
  if (days === 0) return "Today";
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function countdownColor(days: number, prepWindow: number): string {
  if (days === 0) return "#ef4444";
  if (prepWindow > 0 && days <= prepWindow) return "#f59e0b";
  return "var(--ink-3)";
}

// ── Label generation ─────────────────────────────────────────────────────────

function buildDisplayName(o: Occasion, nextDate: string): string {
  const type = (o.occasionType ?? "event") as OccasionType;

  if (type === "birthday" && o.personName) {
    const birthYear = new Date(o.date + "T00:00:00").getFullYear();
    const nextYear = new Date(nextDate + "T00:00:00").getFullYear();
    const age = nextYear - birthYear;
    return age > 0
      ? `${o.personName}'s ${age}${ordinalSuffix(age)} Birthday`
      : `${o.personName}'s Birthday`;
  }
  if (type === "anniversary" && o.personName) {
    const startYear = new Date(o.date + "T00:00:00").getFullYear();
    const nextYear = new Date(nextDate + "T00:00:00").getFullYear();
    const num = nextYear - startYear;
    const ordinal = num > 0 ? `${num}${ordinalSuffix(num)} ` : "";
    return `${o.personName} ${ordinal}Anniversary`;
  }
  return o.name;
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0]!;
}

// ── Holiday seeding ───────────────────────────────────────────────────────────

function usHolidays() {
  const y = new Date().getFullYear();
  return [
    { name: "New Year's Day",   emoji: "🎊", date: `${y}-01-01` },
    { name: "Valentine's Day",  emoji: "💝", date: `${y}-02-14` },
    { name: "St. Patrick's Day",emoji: "🍀", date: `${y}-03-17` },
    { name: "Easter",           emoji: "🐣", date: easterDate(y) },
    { name: "Mother's Day",     emoji: "💐", date: nthWeekdayOfMonth(y, 4, 0, 2) },
    { name: "Memorial Day",     emoji: "🇺🇸", date: lastWeekdayOfMonth(y, 4, 1) },
    { name: "Father's Day",     emoji: "👔", date: nthWeekdayOfMonth(y, 5, 0, 3) },
    { name: "Independence Day", emoji: "🎆", date: `${y}-07-04` },
    { name: "Labor Day",        emoji: "🛠️", date: nthWeekdayOfMonth(y, 8, 1, 1) },
    { name: "Halloween",        emoji: "🎃", date: `${y}-10-31` },
    { name: "Thanksgiving",     emoji: "🦃", date: nthWeekdayOfMonth(y, 10, 4, 4) },
    { name: "Christmas Eve",    emoji: "🎄", date: `${y}-12-24` },
    { name: "Christmas",        emoji: "🎁", date: `${y}-12-25` },
    { name: "New Year's Eve",   emoji: "🥂", date: `${y}-12-31` },
  ];
}

// ── Form dialog ──────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  emoji: string;
  occasionType: OccasionType;
  personName: string;
  startYear: string;
  date: string;
  isAnnual: boolean;
  prepWindowDays: number;
  notes: string;
}

const BLANK: FormState = {
  name: "", emoji: "", occasionType: "event", personName: "",
  startYear: "", date: "", isAnnual: false, prepWindowDays: 0, notes: "",
};

function toFormState(o: Occasion): FormState {
  return {
    name: o.name,
    emoji: o.emoji ?? "",
    occasionType: (o.occasionType ?? "event") as OccasionType,
    personName: o.personName ?? "",
    startYear: o.startYear ? String(o.startYear) : "",
    date: o.date,
    isAnnual: o.isAnnual,
    prepWindowDays: o.prepWindowDays,
    notes: o.notes ?? "",
  };
}

function OccasionDialog({ open, onClose, occasion }: { open: boolean; onClose: () => void; occasion: Occasion | null }) {
  const createOccasion = useCreateOccasion();
  const updateOccasion = useUpdateOccasion();
  const deleteOccasion = useDeleteOccasion();
  const submittedRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK);

  useEffect(() => {
    setForm(occasion ? toFormState(occasion) : BLANK);
    setDeleting(false);
  }, [occasion?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function setType(t: OccasionType) {
    const meta = TYPE_META[t];
    setForm((f) => ({
      ...f,
      occasionType: t,
      isAnnual: meta.alwaysAnnual ? true : f.isAnnual,
      emoji: f.emoji || meta.emoji,
    }));
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const meta = TYPE_META[form.occasionType];

  function computedName(): string {
    if (form.occasionType === "birthday" && form.personName.trim())
      return `${form.personName.trim()}'s Birthday`;
    if (form.occasionType === "anniversary" && form.personName.trim())
      return `${form.personName.trim()} Anniversary`;
    return form.name;
  }

  async function handleSubmit() {
    if (submittedRef.current || !form.date) return;
    const name = computedName().trim();
    if (!name) return;
    submittedRef.current = true;
    try {
      const isAnnual = meta.alwaysAnnual ? true : form.isAnnual;
      const payload = {
        name,
        emoji: form.emoji.trim() || undefined,
        occasionType: form.occasionType,
        personName: form.personName.trim() || undefined,
        startYear: form.startYear ? parseInt(form.startYear) : undefined,
        date: form.date,
        isAnnual,
        prepWindowDays: form.prepWindowDays,
        notes: form.notes.trim() || undefined,
      };
      if (occasion) {
        await updateOccasion.mutateAsync({ id: occasion.id, ...payload });
      } else {
        await createOccasion.mutateAsync(payload);
      }
      onClose();
    } finally {
      submittedRef.current = false;
    }
  }

  async function handleDelete() {
    if (!occasion || submittedRef.current) return;
    submittedRef.current = true;
    try {
      await deleteOccasion.mutateAsync(occasion.id);
      onClose();
    } finally {
      submittedRef.current = false;
    }
  }

  const busy = createOccasion.isPending || updateOccasion.isPending || deleteOccasion.isPending;
  const canSubmit = !!form.date && !!(computedName().trim());

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{occasion ? "Edit Occasion" : "New Occasion"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Type picker */}
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <div className="flex gap-1.5 flex-wrap">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    form.occasionType === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {TYPE_META[t].emoji} {TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* Person name */}
          {meta.showPerson && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="person">
                {form.occasionType === "birthday" ? "Person's name" : "Names"}
              </Label>
              <Input
                id="person"
                value={form.personName}
                onChange={(e) => set("personName", e.target.value)}
                placeholder={form.occasionType === "birthday" ? "Mom" : "Katie & Erik"}
                autoFocus
              />
            </div>
          )}

          {/* Name + emoji for non-person types */}
          {!meta.showPerson && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <div className="flex gap-2">
                <Input
                  id="emoji"
                  value={form.emoji}
                  onChange={(e) => set("emoji", e.target.value)}
                  placeholder={meta.emoji}
                  maxLength={4}
                  className="w-16 text-center text-lg"
                  autoFocus
                />
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder={form.occasionType === "sports" ? "Opening Day" : form.occasionType === "holiday" ? "Christmas" : "Event name"}
                />
              </div>
            </div>
          )}

          {/* Emoji for person types */}
          {meta.showPerson && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emoji-b">Emoji (optional)</Label>
              <Input
                id="emoji-b"
                value={form.emoji}
                onChange={(e) => set("emoji", e.target.value)}
                placeholder={meta.emoji}
                maxLength={4}
                className="w-16 text-center text-lg"
              />
            </div>
          )}

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="date">
              {form.occasionType === "birthday" ? "Birthday" : form.occasionType === "anniversary" ? "Start date" : "Date"}
            </Label>
            <Input
              id="date"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>

          {/* Annual toggle — only for non-always-annual types */}
          {!meta.alwaysAnnual && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.isAnnual}
                onClick={() => set("isAnnual", !form.isAnnual)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.isAnnual ? "bg-primary" : "bg-input"}`}
              >
                <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${form.isAnnual ? "translate-x-4" : "translate-x-0"}`} />
              </button>
              <Label className="cursor-pointer" onClick={() => set("isAnnual", !form.isAnnual)}>
                Repeats annually
              </Label>
            </div>
          )}

          {/* Prep window */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prep">Prep window (days before)</Label>
            <Input
              id="prep"
              type="number"
              min={0}
              max={365}
              value={form.prepWindowDays || ""}
              onChange={(e) => set("prepWindowDays", Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="None"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <DialogFooter>
          {occasion && !deleting && (
            <Button variant="destructive" onClick={() => setDeleting(true)} disabled={busy} className="mr-auto">
              Delete
            </Button>
          )}
          {deleting && (
            <Button variant="destructive" onClick={handleDelete} disabled={busy} className="mr-auto">
              Confirm delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy || !canSubmit}>
            {occasion ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OccasionsPage() {
  const { data: occasions = [], isLoading } = useOccasions();
  const createOccasion = useCreateOccasion();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Occasion | null>(null);
  const [seedingHolidays, setSeedingHolidays] = useState(false);
  const [typeFilter, setTypeFilter] = useState<OccasionType | "all">("all");
  const [showPast, setShowPast] = useState(false);

  function openAdd() { setEditing(null); setDialogOpen(true); }
  function openEdit(o: Occasion) { setEditing(o); setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditing(null); }

  async function seedHolidays() {
    setSeedingHolidays(true);
    const existingNames = new Set(occasions.map((o) => o.name.toLowerCase()));
    const holidays = usHolidays().filter((h) => !existingNames.has(h.name.toLowerCase()));
    for (const h of holidays) {
      await createOccasion.mutateAsync({
        name: h.name, emoji: h.emoji, occasionType: "holiday",
        date: h.date, isAnnual: true, prepWindowDays: 0,
      });
    }
    setSeedingHolidays(false);
  }

  const withNext = occasions
    .map((o) => ({ ...o, nextDate: nextOccurrenceForOccasion(o) }))
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate));

  const pastItems = withNext.filter((o) => daysUntil(o.nextDate) < 0);
  const activeItems = withNext.filter((o) => daysUntil(o.nextDate) >= 0);

  const visibleItems = (typeFilter === "all" ? activeItems : activeItems.filter((o) => (o.occasionType ?? "event") === typeFilter));
  const visiblePast = (typeFilter === "all" ? pastItems : pastItems.filter((o) => (o.occasionType ?? "event") === typeFilter));

  const hasHolidays = occasions.some((o) => o.occasionType === "holiday");

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "32px 16px 20px 16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 30, lineHeight: 1.15, letterSpacing: "-0.02em", color: "var(--ink)", margin: "0 0 4px 0" }}>
            Occasions
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>
            Birthdays, anniversaries, and milestones
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          {!hasHolidays && (
            <Button onClick={seedHolidays} disabled={seedingHolidays} variant="outline" size="sm">
              {seedingHolidays ? "Adding…" : "Add US Holidays"}
            </Button>
          )}
          <Button onClick={openAdd} size="sm">+ Add</Button>
        </div>
      </div>

      {/* Type filter pills */}
      {occasions.length > 0 && (
        <div style={{ display: "flex", gap: 6, padding: "0 16px 16px 16px", flexWrap: "wrap" }}>
          {(["all", ...TYPES.filter((t) => occasions.some((o) => (o.occasionType ?? "event") === t))] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              style={{
                padding: "4px 12px",
                borderRadius: 100,
                border: `1px solid ${typeFilter === t ? "var(--primary)" : "var(--hairline)"}`,
                background: typeFilter === t ? "var(--primary)" : "transparent",
                color: typeFilter === t ? "var(--primary-foreground)" : "var(--ink-3)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {t === "all" ? "All" : `${TYPE_META[t].emoji} ${TYPE_META[t].label}`}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: "0 16px" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 64, background: "var(--surface)", borderRadius: 12, marginBottom: 8, opacity: 0.5 }} />
          ))}
        </div>
      ) : occasions.length === 0 ? (
        <div style={{ padding: "48px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--ink-4)", margin: "0 0 16px 0" }}>No occasions yet.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <Button onClick={seedHolidays} disabled={seedingHolidays} variant="outline" size="sm">
              {seedingHolidays ? "Adding…" : "Add US Holidays"}
            </Button>
            <Button onClick={openAdd} variant="outline" size="sm">Add manually</Button>
          </div>
        </div>
      ) : visibleItems.length === 0 && visiblePast.length === 0 ? (
        <div style={{ padding: "48px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>
            No {typeFilter === "all" ? "" : TYPE_META[typeFilter as OccasionType].label.toLowerCase() + " "}occasions.
          </p>
        </div>
      ) : (
        <>
          <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 6 }}>
            {visibleItems.map((o) => (
              <OccasionRow key={o.id} occasion={o} nextDate={o.nextDate} onClick={() => openEdit(o)} />
            ))}
          </div>

          {/* Past non-annual events */}
          {visiblePast.length > 0 && (
            <div style={{ padding: "16px 16px 0 16px" }}>
              {showPast ? (
                <>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-4)", fontWeight: 600, marginBottom: 10 }}>
                    Past
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: 0.6 }}>
                    {visiblePast.map((o) => (
                      <OccasionRow key={o.id} occasion={o} nextDate={o.nextDate} onClick={() => openEdit(o)} />
                    ))}
                  </div>
                  <button
                    onClick={() => setShowPast(false)}
                    style={{ fontSize: 12, color: "var(--ink-4)", background: "none", border: "none", cursor: "pointer", padding: "12px 0 0 0" }}
                  >
                    Hide past events
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowPast(true)}
                  style={{ fontSize: 12, color: "var(--ink-4)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Show {visiblePast.length} past {visiblePast.length === 1 ? "event" : "events"}
                </button>
              )}
            </div>
          )}
        </>
      )}

      <OccasionDialog open={dialogOpen} onClose={closeDialog} occasion={editing} />
    </div>
  );
}

function OccasionRow({ occasion, nextDate, onClick }: { occasion: Occasion; nextDate: string; onClick: () => void }) {
  const days = daysUntil(nextDate);
  const color = countdownColor(days, occasion.prepWindowDays);
  const isToday = days === 0;
  const inPrepWindow = !isToday && occasion.prepWindowDays > 0 && days <= occasion.prepWindowDays;
  const type = (occasion.occasionType ?? "event") as OccasionType;
  const typeMeta = TYPE_META[type];
  const displayName = buildDisplayName(occasion, nextDate);
  const formattedDate = new Date(nextDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" });

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: isToday
          ? "color-mix(in srgb, #f59e0b 10%, var(--surface))"
          : "var(--surface)",
        border: `1px solid ${isToday ? "color-mix(in srgb, #f59e0b 25%, transparent)" : inPrepWindow ? "#f59e0b44" : "var(--hairline)"}`,
        borderRadius: 12,
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <div style={{ fontSize: 22, flexShrink: 0, width: 32, textAlign: "center" }}>
        {occasion.emoji ?? typeMeta.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {displayName}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-4)", display: "flex", alignItems: "center", gap: 6 }}>
          <span>{formattedDate}</span>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "1px 6px",
            borderRadius: 100,
            fontSize: 10,
            fontWeight: 600,
            background: `${typeMeta.color}20`,
            color: typeMeta.color,
          }}>
            {typeMeta.label}
          </span>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>
          {formatCountdown(days)}
        </div>
        {inPrepWindow && (
          <div style={{ fontSize: 11, color: "#f59e0b" }}>prep window</div>
        )}
      </div>
    </button>
  );
}
