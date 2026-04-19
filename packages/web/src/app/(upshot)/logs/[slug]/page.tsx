"use client";

import { use, useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useLogs, useLogEntries, useCreateLogEntry, useUpdateLogEntry, useDeleteLogEntry } from "@/hooks/use-logs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Log, LogEntry } from "@todo/db";

interface Props {
  params: Promise<{ slug: string }>;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateShort(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Gas MPG area chart ───────────────────────────────────────────────────────

type ChartRange = "30" | "1yr" | "all";

function MpgChart({ entries, color, range }: { entries: LogEntry[]; color: string; range: ChartRange }) {
  const pts = useMemo(() => {
    const filtered = entries.filter((e) => e.numericValue != null && e.numericValue > 10 && e.numericValue < 80);
    const now = Date.now();
    const cutoff = range === "30"
      ? now - 30 * 86400000 * 10  // ~last 30 fills → use entry count instead
      : range === "1yr"
      ? now - 365 * 86400000
      : 0;
    const ranged = range === "30"
      ? filtered.slice(0, 30)
      : range === "1yr"
      ? filtered.filter((e) => new Date(e.loggedAt + "T00:00:00").getTime() >= cutoff)
      : filtered;
    return [...ranged].reverse(); // oldest → newest for chart
  }, [entries, range]);

  if (pts.length < 2) return null;

  const W = 600; const H = 80;
  const pad = 6;
  const mpgs = pts.map((e) => e.numericValue!);
  const minMpg = Math.min(...mpgs) - 1;
  const maxMpg = Math.max(...mpgs) + 1;
  const range_ = maxMpg - minMpg;

  // X by actual date
  const dates = pts.map((e) => new Date(e.loggedAt + "T00:00:00").getTime());
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];
  const dateRange = maxDate - minDate || 1;

  const coords = pts.map((e, i) => {
    const x = ((dates[i] - minDate) / dateRange) * (W - pad * 2) + pad;
    const y = H - pad - ((e.numericValue! - minMpg) / range_) * (H - pad * 2);
    return { x, y, e };
  });

  const linePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");

  // Smooth area path
  const areaPath = `M ${coords[0].x},${H} L ${coords[0].x},${coords[0].y} ${coords
    .slice(1)
    .map((c) => `L ${c.x},${c.y}`)
    .join(" ")} L ${coords[coords.length - 1].x},${H} Z`;

  const bestMpg = Math.max(...mpgs);
  const bestIdx = mpgs.indexOf(bestMpg);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, overflow: "visible" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="mpg-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#mpg-fill)" />
      <polyline points={linePoints} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Best MPG dot */}
      {coords[bestIdx] && (
        <circle cx={coords[bestIdx].x} cy={coords[bestIdx].y} r="4" fill={color} />
      )}
      {/* Latest dot */}
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="3.5" fill={color} />
    </svg>
  );
}

// ─── Trend badge ──────────────────────────────────────────────────────────────

function MpgBadge({ mpg, prevMpg, isBest }: { mpg: number; prevMpg: number | null; isBest: boolean }) {
  const delta = prevMpg != null ? mpg - prevMpg : null;
  const arrow = delta == null ? null : delta > 0.3 ? "↑" : delta < -0.3 ? "↓" : null;
  const arrowColor = arrow === "↑" ? "var(--success)" : "var(--ink-4)";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {isBest && (
          <span style={{ fontSize: 9, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.04em", background: "var(--accent-soft)", padding: "1px 5px", borderRadius: 4 }}>BEST</span>
        )}
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{mpg.toFixed(1)}</span>
        {arrow && <span style={{ fontSize: 12, color: arrowColor, lineHeight: 1 }}>{arrow}</span>}
      </div>
      <span style={{ fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>mpg</span>
    </div>
  );
}

// ─── Gas entry row ────────────────────────────────────────────────────────────

function GasRow({ entry, prevEntry, bestMpg, onClick }: {
  entry: LogEntry; prevEntry: LogEntry | null; bestMpg: number | null; onClick: () => void;
}) {
  const data: Record<string, unknown> = entry.data ? JSON.parse(entry.data) : {};
  const gallons = data.gallons as number | undefined;
  const ppg = data.pricePerGallon as number | undefined;
  const total = data.totalCost as number | undefined;
  const station = data.station as string | undefined;
  const mpg = entry.numericValue;

  const prevMpg = prevEntry?.numericValue ?? null;
  const isBest = mpg != null && bestMpg != null && Math.abs(mpg - bestMpg) < 0.01;

  const displayTotal = total ?? (gallons && ppg ? gallons * ppg : null);

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--hairline)",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {/* Date + station */}
      <div style={{ flex: "0 0 90px", minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{formatDateShort(entry.loggedAt)}</div>
        {station && <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{station}</div>}
      </div>

      {/* Price + volume */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {ppg != null && (
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
            ${ppg.toFixed(3)}<span style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-4)", marginLeft: 2 }}>/gal</span>
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
          {gallons != null && `${gallons.toFixed(2)} gal`}
          {displayTotal != null && gallons != null && " · "}
          {displayTotal != null && `$${displayTotal.toFixed(2)}`}
        </div>
      </div>

      {/* MPG */}
      {mpg != null && <MpgBadge mpg={mpg} prevMpg={prevMpg} isBest={isBest} />}
    </button>
  );
}

// ─── Quick-log drawer ─────────────────────────────────────────────────────────

interface GasForm {
  gallons: string;
  pricePerGallon: string;
  odometer: string;
  station: string;
  grade: string;
  date: string;
  notes: string;
}

function gasDefaults(): GasForm {
  return { gallons: "", pricePerGallon: "", odometer: "", station: "", grade: "regular", date: todayStr(), notes: "" };
}

function entryToGasForm(data: Record<string, unknown>, loggedAt: string, notes: string): GasForm {
  return {
    gallons: data.gallons != null ? String(data.gallons) : "",
    pricePerGallon: data.pricePerGallon != null ? String(data.pricePerGallon) : "",
    odometer: data.odometer != null ? String(data.odometer) : "",
    station: String(data.station ?? ""),
    grade: String(data.grade ?? "regular"),
    date: loggedAt,
    notes,
  };
}

function GasLogDialog({
  open, onClose, log, entry, entries,
}: {
  open: boolean; onClose: () => void;
  log: Log; entry: LogEntry | null; entries: LogEntry[];
}) {
  const createEntry = useCreateLogEntry(log.id);
  const updateEntry = useUpdateLogEntry(log.id);
  const deleteEntry = useDeleteLogEntry(log.id);
  const submittedRef = useRef(false);
  const [form, setForm] = useState<GasForm>(gasDefaults());
  const [showMore, setShowMore] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const knownStations = useMemo(() => {
    const seen = new Set<string>();
    for (const e of entries) {
      const d: Record<string, unknown> = e.data ? JSON.parse(e.data) : {};
      const s = d.station as string | undefined;
      if (s) seen.add(s);
    }
    return [...seen].sort();
  }, [entries]);

  useEffect(() => {
    if (open) {
      if (entry) {
        const data = entry.data ? (JSON.parse(entry.data) as Record<string, unknown>) : {};
        setForm(entryToGasForm(data, entry.loggedAt, entry.notes ?? ""));
        setShowMore(true);
      } else {
        setForm(gasDefaults());
        setShowMore(false);
      }
      setDeleting(false);
    }
  }, [open, entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof GasForm) => (v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const autoTotal =
    form.gallons && form.pricePerGallon
      ? (parseFloat(form.gallons) * parseFloat(form.pricePerGallon)).toFixed(2)
      : null;

  const prevEntry = useMemo(() => {
    const sorted = [...entries].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
    if (entry) return sorted.find((e) => e.loggedAt < entry.loggedAt) ?? null;
    return sorted.find((e) => e.loggedAt < form.date) ?? sorted[0] ?? null;
  }, [entries, entry, form.date]);

  const computedMpg = useMemo(() => {
    if (!form.gallons || !form.odometer) return null;
    const prevData = prevEntry?.data ? (JSON.parse(prevEntry.data) as Record<string, unknown>) : null;
    const prevOdo = prevData?.odometer as number | undefined;
    if (!prevOdo) return null;
    const mpg = (parseFloat(form.odometer) - prevOdo) / parseFloat(form.gallons);
    return isNaN(mpg) || mpg <= 0 ? null : mpg;
  }, [form.gallons, form.odometer, prevEntry]);

  async function handleSubmit() {
    if (submittedRef.current || !form.date) return;
    submittedRef.current = true;
    try {
      const data: Record<string, unknown> = {};
      if (form.gallons) data.gallons = parseFloat(form.gallons);
      if (form.pricePerGallon) data.pricePerGallon = parseFloat(form.pricePerGallon);
      if (autoTotal) data.totalCost = parseFloat(autoTotal);
      if (form.odometer) data.odometer = parseInt(form.odometer);
      if (form.station) data.station = form.station;
      if (form.grade) data.grade = form.grade;

      const payload = {
        loggedAt: form.date,
        numericValue: computedMpg ?? null,
        data,
        notes: form.notes.trim() || undefined,
      };

      if (entry) {
        await updateEntry.mutateAsync({ entryId: entry.id, ...payload });
      } else {
        await createEntry.mutateAsync(payload);
      }
      onClose();
    } finally {
      submittedRef.current = false;
    }
  }

  async function handleDelete() {
    if (!entry || submittedRef.current) return;
    submittedRef.current = true;
    try {
      await deleteEntry.mutateAsync(entry.id);
      onClose();
    } finally {
      submittedRef.current = false;
    }
  }

  const busy = createEntry.isPending || updateEntry.isPending || deleteEntry.isPending;
  const isEdit = !!entry;

  const bigInputStyle: React.CSSProperties = {
    fontSize: 28,
    fontWeight: 500,
    fontVariantNumeric: "tabular-nums",
    height: 64,
    borderRadius: 12,
    border: "1.5px solid var(--hairline)",
    background: "var(--bg-sunken)",
    color: "var(--ink)",
    padding: "0 16px",
    width: "100%",
    outline: "none",
    fontFamily: "var(--font-ui)",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit fill-up" : "⛽ Log fill-up"}</DialogTitle>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Primary inputs: Gallons + $/gal */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Gallons</label>
              <input
                inputMode="decimal"
                placeholder="11.234"
                value={form.gallons}
                onChange={(e) => set("gallons")(e.target.value)}
                style={bigInputStyle}
                autoFocus={!isEdit}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Price / gal</label>
              <input
                inputMode="decimal"
                placeholder="3.490"
                value={form.pricePerGallon}
                onChange={(e) => set("pricePerGallon")(e.target.value)}
                style={bigInputStyle}
              />
            </div>
          </div>

          {/* Auto total */}
          <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {autoTotal ? (
              <span style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
                = ${autoTotal}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: "var(--ink-4)" }}>Enter gallons and price to see total</span>
            )}
          </div>

          {/* Odometer */}
          <div>
            <label style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 10, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Odometer
              {computedMpg && (
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--success)", textTransform: "none", letterSpacing: "normal" }}>→ {computedMpg.toFixed(1)} MPG</span>
              )}
            </label>
            <input
              inputMode="numeric"
              placeholder="48900"
              value={form.odometer}
              onChange={(e) => set("odometer")(e.target.value)}
              style={{ ...bigInputStyle, fontSize: 22, height: 52 }}
            />
          </div>

          {/* Station — always visible, autocomplete from history */}
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Station</label>
            <input
              list="gas-stations"
              type="text"
              placeholder="Costco, BP, Shell…"
              value={form.station}
              onChange={(e) => set("station")(e.target.value)}
              style={{ width: "100%", height: 36, borderRadius: 6, border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", fontSize: 14, padding: "0 10px", outline: "none" }}
            />
            <datalist id="gas-stations">
              {knownStations.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>

          {/* More details disclosure */}
          <button
            type="button"
            onClick={() => setShowMore((x) => !x)}
            style={{ fontSize: 13, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4, alignSelf: "flex-start" }}
          >
            <span style={{ fontSize: 11 }}>{showMore ? "▾" : "▸"}</span>
            {showMore ? "Fewer details" : "More details (grade, date, notes)"}
          </button>

          {showMore && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 4, borderTop: "1px solid var(--border)" }}>
              {/* Grade */}
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Grade</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["regular", "midgrade", "premium", "diesel"].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => set("grade")(g)}
                      style={{
                        flex: 1, padding: "7px 4px", borderRadius: 10,
                        border: `1.5px solid ${form.grade === g ? "var(--primary)" : "var(--border)"}`,
                        background: form.grade === g ? "color-mix(in oklch, var(--primary) 10%, transparent)" : "transparent",
                        color: form.grade === g ? "var(--primary)" : "var(--muted-foreground)",
                        fontSize: 12, fontWeight: form.grade === g ? 600 : 400, cursor: "pointer", textTransform: "capitalize",
                      }}
                    >{g}</button>
                  ))}
                </div>
              </div>

              {/* Date + Notes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Date</label>
                  <Input type="date" value={form.date} onChange={(e) => set("date")(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Notes</label>
                  <Input type="text" placeholder="Optional" value={form.notes} onChange={(e) => set("notes")(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {isEdit && !deleting && <Button variant="destructive" onClick={() => setDeleting(true)} disabled={busy} className="sm:mr-auto">Delete</Button>}
          {isEdit && deleting && <Button variant="destructive" onClick={handleDelete} disabled={busy} className="sm:mr-auto">Confirm delete</Button>}
          {!isEdit && <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>}
          {isEdit && <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>}
          <Button onClick={handleSubmit} disabled={busy || !form.date} style={!isEdit ? { flex: 1 } : undefined}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Log it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Gas stats summary ────────────────────────────────────────────────────────

function StatChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 2, paddingRight: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: accent ? "var(--accent)" : "var(--ink)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

// ─── Gas log page ─────────────────────────────────────────────────────────────

function GasLogPage({ log, entries, isLoading }: { log: Log; entries: LogEntry[]; isLoading: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LogEntry | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>("30");

  function openAdd() { setEditingEntry(null); setDialogOpen(true); }
  function openEdit(e: LogEntry) { setEditingEntry(e); setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditingEntry(null); }

  const { sorted, bestMpg, avgMpg, totalSpent, avgFillCost, avgPpg } = useMemo(() => {
    const sorted = [...entries].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
    const withMpg = sorted.filter((e) => e.numericValue != null && e.numericValue > 10 && e.numericValue < 80);
    const bestMpg = withMpg.length ? Math.max(...withMpg.map((e) => e.numericValue!)) : null;
    const avgMpg = withMpg.length ? withMpg.reduce((s, e) => s + e.numericValue!, 0) / withMpg.length : null;

    const costs = sorted
      .map((e) => {
        const d: Record<string, unknown> = e.data ? JSON.parse(e.data) : {};
        return (d.totalCost as number | undefined) ?? ((d.gallons as number | undefined) && (d.pricePerGallon as number | undefined)
          ? (d.gallons as number) * (d.pricePerGallon as number)
          : null);
      })
      .filter((c): c is number => c != null);

    const totalSpent = costs.reduce((s, c) => s + c, 0);
    const avgFillCost = costs.length ? totalSpent / costs.length : null;

    const ppgs = sorted.map((e) => {
      const d: Record<string, unknown> = e.data ? JSON.parse(e.data) : {};
      return d.pricePerGallon as number | undefined;
    }).filter((p): p is number => p != null);
    const avgPpg = ppgs.length ? ppgs.reduce((s, p) => s + p, 0) / ppgs.length : null;

    return { sorted, bestMpg, avgMpg, totalSpent, avgFillCost, avgPpg };
  }, [entries]);

  const accentColor = log.color ?? "var(--accent)";

  return (
    <div style={{ maxWidth: 640, paddingBottom: 100 }}>
      {/* Compact header */}
      <div style={{ padding: "28px 20px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          <span style={{ fontSize: 22 }}>{log.icon ?? "⛽"}</span>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 26, lineHeight: 1.15, letterSpacing: "-0.02em", color: "var(--ink)", margin: 0 }}>
            {log.name}
          </h1>
          <span style={{ fontSize: 12, color: "var(--ink-4)", marginLeft: 4, marginTop: 4 }}>{entries.length} fills</span>
        </div>
      </div>

      {/* MPG chart card */}
      {entries.length >= 2 && (
        <div style={{ margin: "0 16px 16px", background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 16, overflow: "hidden" }}>
          {/* Stats row */}
          <div style={{ padding: "16px 20px 12px", display: "flex", overflowX: "auto", scrollbarWidth: "none", borderBottom: "1px solid var(--hairline)" }}>
            {avgMpg != null && <StatChip label="Avg MPG" value={avgMpg.toFixed(1)} accent />}
            {bestMpg != null && <StatChip label="Best MPG" value={bestMpg.toFixed(1)} />}
            {totalSpent > 0 && <StatChip label="Total spent" value={`$${totalSpent.toLocaleString("en-US", { maximumFractionDigits: 0 })}`} />}
            {avgFillCost != null && <StatChip label="Avg fill" value={`$${avgFillCost.toFixed(2)}`} />}
            {avgPpg != null && <StatChip label="Avg $/gal" value={`$${avgPpg.toFixed(3)}`} />}
          </div>

          {/* Chart */}
          <div style={{ padding: "16px 20px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.07em" }}>MPG trend</span>
              <div style={{ display: "flex", gap: 4 }}>
                {(["30", "1yr", "all"] as ChartRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setChartRange(r)}
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 6,
                      border: `1px solid ${chartRange === r ? "var(--accent)" : "var(--hairline)"}`,
                      background: chartRange === r ? "var(--accent-soft)" : "transparent",
                      color: chartRange === r ? "var(--accent-ink)" : "var(--ink-4)",
                      cursor: "pointer",
                      fontWeight: chartRange === r ? 600 : 400,
                    }}
                  >
                    {r === "30" ? "30 fills" : r === "1yr" ? "1 yr" : "All"}
                  </button>
                ))}
              </div>
            </div>
            <MpgChart entries={entries} color={accentColor} range={chartRange} />
          </div>
        </div>
      )}

      {/* Entries */}
      <div style={{ margin: "0 16px", background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 16, overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 20 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 56, background: "var(--bg-sunken)", borderRadius: 10, marginBottom: 8, opacity: 0.5 }} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⛽</div>
            <p style={{ fontSize: 13, color: "var(--ink-4)", margin: "0 0 16px 0" }}>No fill-ups yet.</p>
            <button
              onClick={openAdd}
              style={{ fontSize: 13, color: "var(--accent)", background: "none", border: "1px solid var(--accent)", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}
            >
              Log first fill-up
            </button>
          </div>
        ) : (
          sorted.map((entry, i) => {
            const prevEntry = i < sorted.length - 1 ? sorted[i + 1] : null;
            return (
              <GasRow
                key={entry.id}
                entry={entry}
                prevEntry={prevEntry}
                bestMpg={bestMpg}
                onClick={() => openEdit(entry)}
              />
            );
          })
        )}
      </div>

      {/* Floating action button */}
      <button
        onClick={openAdd}
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "14px 22px",
          borderRadius: 100,
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 4px 20px oklch(0 0 0 / 0.18), 0 1px 4px oklch(0 0 0 / 0.12)",
          fontFamily: "var(--font-ui)",
          zIndex: 20,
        }}
      >
        <span>⛽</span>
        <span>Log fill-up</span>
      </button>

      <GasLogDialog open={dialogOpen} onClose={closeDialog} log={log} entry={editingEntry} entries={entries} />
    </div>
  );
}

// ─── Mowing log page ──────────────────────────────────────────────────────────

const MOWING_PATTERNS = [
  { key: "East-West",   label: "E–W",    symbol: "→" },
  { key: "North-South", label: "N–S",    symbol: "↑" },
  { key: "Diagonal \\", label: "Diag ╲", symbol: "╲" },
  { key: "Diagonal /",  label: "Diag ╱", symbol: "╱" },
] as const;

const DEFAULT_HEIGHT = "3.5";

function getMowingPattern(data: Record<string, unknown>): string | undefined {
  // "pattern" is the canonical key; "direction" was used by the original import
  return (data.pattern as string | undefined) ?? (data.direction as string | undefined);
}

function nextMowingPattern(last: string | undefined): string {
  const keys = MOWING_PATTERNS.map((p) => p.key);
  if (!last) return keys[0]!;
  const idx = keys.findIndex((k) => k === last);
  return keys[(idx < 0 ? 0 : idx + 1) % keys.length]!;
}

function StripeIcon({ pattern, size = 28, color = "currentColor" }: { pattern: string; size?: number; color?: string }) {
  const n = size;
  const off = n / 3;
  const sw = 2;
  const isEW = pattern.includes("East");
  const isNS = pattern.includes("North");
  const isDiagBs = pattern.includes("\\");
  let lines: React.ReactElement[];
  if (isEW) {
    lines = [0.25, 0.5, 0.75].map((f, i) => <line key={i} x1={2} y1={n * f} x2={n - 2} y2={n * f} stroke={color} strokeWidth={sw} strokeLinecap="round" />);
  } else if (isNS) {
    lines = [0.25, 0.5, 0.75].map((f, i) => <line key={i} x1={n * f} y1={2} x2={n * f} y2={n - 2} stroke={color} strokeWidth={sw} strokeLinecap="round" />);
  } else if (isDiagBs) {
    // \ : top-left to bottom-right
    lines = [-off, 0, off].map((o, i) => <line key={i} x1={o} y1={0} x2={o + n} y2={n} stroke={color} strokeWidth={sw} strokeLinecap="round" />);
  } else {
    // / : top-right to bottom-left
    lines = [-off, 0, off].map((o, i) => <line key={i} x1={n + o} y1={0} x2={o} y2={n} stroke={color} strokeWidth={sw} strokeLinecap="round" />);
  }
  return (
    <svg width={n} height={n} viewBox={`0 0 ${n} ${n}`} style={{ overflow: "hidden", display: "block", flexShrink: 0 }}>
      {lines}
    </svg>
  );
}

function SeasonTimeline({ seasons, accent }: { seasons: { year: string; list: LogEntry[] }[]; accent: string }) {
  // Show up to 3 seasons, each as a horizontal Apr 1 – Nov 30 timeline with dot per mow
  const SEASON_START_MM = 4; // April
  const SEASON_END_MM = 11;  // November
  const totalDays = (new Date(2000, SEASON_END_MM, 30).getTime() - new Date(2000, SEASON_START_MM - 1, 1).getTime()) / 86400000;

  function dayOffset(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    const refYear = 2000;
    const start = new Date(refYear, SEASON_START_MM - 1, 1).getTime();
    const point = new Date(refYear, d.getMonth(), d.getDate()).getTime();
    return Math.max(0, Math.min(1, (point - start) / (totalDays * 86400000)));
  }

  const shown = seasons.slice(0, 3);
  const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 16, padding: "16px 20px" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Season timeline</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {shown.map(({ year, list }) => (
          <div key={year}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", width: 34, flexShrink: 0 }}>{year}</div>
              <div style={{ flex: 1, position: "relative", height: 18 }}>
                {/* track */}
                <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2, background: "var(--hairline)", transform: "translateY(-50%)", borderRadius: 2 }} />
                {/* dots */}
                {list.map((entry) => {
                  const pct = dayOffset(entry.loggedAt.slice(0, 10));
                  const inSeason = pct >= 0 && pct <= 1;
                  return inSeason ? (
                    <div key={entry.id} style={{
                      position: "absolute", top: "50%", left: `${pct * 100}%`,
                      transform: "translate(-50%, -50%)",
                      width: 7, height: 7, borderRadius: "50%",
                      background: accent, opacity: 0.85,
                    }} />
                  ) : null;
                })}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-4)", width: 40, textAlign: "right", flexShrink: 0 }}>{list.length} mow{list.length !== 1 ? "s" : ""}</div>
            </div>
          </div>
        ))}
      </div>
      {/* Month labels */}
      <div style={{ display: "flex", marginLeft: 44, marginTop: 8 }}>
        {months.map((m, i) => (
          <div key={m} style={{ flex: 1, fontSize: 9, color: "var(--ink-5, var(--ink-4))", textAlign: i === months.length - 1 ? "right" : "left" }}>{m}</div>
        ))}
      </div>
    </div>
  );
}

function RotationCard({ entries, accent }: { entries: LogEntry[]; accent: string }) {
  const lastPattern = useMemo(() => {
    const last = [...entries].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))[0];
    const data: Record<string, unknown> = last?.data ? JSON.parse(last.data) : {};
    return getMowingPattern(data);
  }, [entries]);
  const nextPattern = nextMowingPattern(lastPattern);

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 16, padding: "16px 20px" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Pattern rotation</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {MOWING_PATTERNS.map((p) => {
          const isNext = p.key === nextPattern;
          const isLast = p.key === lastPattern;
          return (
            <div key={p.key} style={{ textAlign: "center", opacity: !isNext && !isLast ? 0.4 : 1 }}>
              <div style={{
                borderRadius: 10, padding: "10px 6px 8px", marginBottom: 5, position: "relative",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                background: isNext ? `color-mix(in oklch, ${accent} 12%, transparent)` : "transparent",
                border: `1.5px solid ${isNext ? accent : "var(--hairline)"}`,
              }}>
                {isNext && (
                  <div style={{
                    position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)",
                    fontSize: 8, fontWeight: 700, color: "white", background: accent,
                    padding: "1px 6px", borderRadius: 100, letterSpacing: "0.08em",
                    textTransform: "uppercase", whiteSpace: "nowrap",
                  }}>Next</div>
                )}
                <StripeIcon pattern={p.key} size={32} color={isNext ? accent : "var(--ink-3)"} />
                <div style={{ fontSize: 11, color: isNext ? accent : "var(--ink-4)" }}>{p.symbol}</div>
              </div>
              <div style={{ fontSize: 10, color: "var(--ink-4)", lineHeight: 1.3, whiteSpace: "nowrap" }}>{p.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MowingRow({ entry, onClick, isFirstOfSeason }: { entry: LogEntry; onClick: () => void; isFirstOfSeason?: boolean }) {
  const data = useMemo<Record<string, unknown>>(() => entry.data ? JSON.parse(entry.data) : {}, [entry.data]);
  const pattern = getMowingPattern(data);
  const height = data.height as string | undefined;
  const bagged = data.bagged as boolean | undefined;
  // Only show height if it differs from the 3.5" default
  const showHeight = height && height !== DEFAULT_HEIGHT;
  // Suppress cross-season gaps (first mow of season)
  const daysSince = !isFirstOfSeason && entry.numericValue != null && entry.numericValue <= 25 ? entry.numericValue : null;
  const d = new Date(entry.loggedAt + "T00:00:00");
  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
  const pillBase: React.CSSProperties = { fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 6, background: "var(--bg-sunken)", color: "var(--ink-3)" };
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "11px 16px",
      width: "100%", textAlign: "left", cursor: "pointer",
      background: "none", border: "none", borderBottom: "1px solid var(--hairline)",
    }}>
      <div style={{ width: 60, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", lineHeight: 1.25 }}>{dateStr}</div>
        <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{dayName}</div>
      </div>
      {pattern && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <StripeIcon pattern={pattern} size={22} color="var(--ink-3)" />
          <span style={{ fontSize: 12, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pattern}</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
        {bagged && <span style={{ ...pillBase, color: "var(--ink-4)" }}>Bagged</span>}
        {showHeight && <span style={pillBase}>{height}"</span>}
        {daysSince != null && (
          <span style={{
            ...pillBase,
            fontVariantNumeric: "tabular-nums", fontWeight: 600,
            color: daysSince >= 10 ? "var(--warning, oklch(60% 0.15 80))" : "var(--ink-4)",
          }}>{daysSince}d</span>
        )}
      </div>
    </button>
  );
}

const HEIGHT_OPTIONS = ["", "2.5", "3", "3.5", "4"];

interface MowingDialogForm { pattern: string; height: string; bagged: boolean; date: string; notes: string; }
function mowingDialogDefaults(suggested: string): MowingDialogForm {
  return { pattern: suggested, height: "", bagged: false, date: todayStr(), notes: "" };
}

function MowingDialog({ open, onClose, log, entry, entries }: {
  open: boolean; onClose: () => void; log: Log; entry: LogEntry | null; entries: LogEntry[];
}) {
  const accent = log.color ?? "oklch(50% 0.15 140)";
  const createEntry = useCreateLogEntry(log.id);
  const updateEntry = useUpdateLogEntry(log.id);
  const deleteEntry = useDeleteLogEntry(log.id);
  const submittedRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<MowingDialogForm>(() => mowingDialogDefaults("East-West"));

  const sorted = useMemo(() => [...entries].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)), [entries]);
  const suggested = useMemo(() => {
    const last = sorted[0];
    const data: Record<string, unknown> = last?.data ? JSON.parse(last.data) : {};
    return nextMowingPattern(getMowingPattern(data));
  }, [sorted]);

  const daysSince = useMemo(() => {
    const prev = sorted.find((e) => e.loggedAt < form.date);
    if (!prev) return null;
    const diff = Math.round((new Date(form.date + "T00:00:00").getTime() - new Date(prev.loggedAt + "T00:00:00").getTime()) / 86400000);
    return diff > 0 && diff <= 25 ? diff : null;
  }, [sorted, form.date]);

  useEffect(() => {
    if (open) {
      if (entry) {
        const data: Record<string, unknown> = entry.data ? JSON.parse(entry.data) : {};
        setForm({ pattern: getMowingPattern(data) ?? suggested, height: String(data.height ?? ""), bagged: Boolean(data.bagged), date: entry.loggedAt, notes: entry.notes ?? "" });
      } else {
        setForm(mowingDialogDefaults(suggested));
      }
      setDeleting(false);
    }
  }, [open, entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof MowingDialogForm>(k: K) => (v: MowingDialogForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit() {
    if (submittedRef.current || !form.pattern) return;
    submittedRef.current = true;
    try {
      const data: Record<string, unknown> = { pattern: form.pattern, bagged: form.bagged };
      if (form.height) data.height = form.height;
      const payload = { loggedAt: form.date, numericValue: daysSince, data, notes: form.notes.trim() || undefined };
      if (entry) { await updateEntry.mutateAsync({ entryId: entry.id, ...payload }); }
      else { await createEntry.mutateAsync(payload); }
      onClose();
    } finally { submittedRef.current = false; }
  }

  async function handleDelete() {
    if (!entry || submittedRef.current) return;
    submittedRef.current = true;
    try { await deleteEntry.mutateAsync(entry.id); onClose(); }
    finally { submittedRef.current = false; }
  }

  const busy = createEntry.isPending || updateEntry.isPending || deleteEntry.isPending;
  const isEdit = !!entry;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit mow" : "Log mow"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {/* Pattern */}
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Pattern</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {MOWING_PATTERNS.map((p) => {
                const active = form.pattern === p.key;
                return (
                  <button key={p.key} type="button" onClick={() => set("pattern")(p.key)} style={{
                    border: `2px solid ${active ? accent : "var(--hairline)"}`,
                    borderRadius: 10, cursor: "pointer", display: "flex",
                    flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5,
                    height: 72, padding: "0 4px",
                    background: active ? `color-mix(in oklch, ${accent} 10%, transparent)` : "var(--bg-sunken)",
                    transition: "border-color 0.1s, background 0.1s",
                  }}>
                    <StripeIcon pattern={p.key} size={28} color={active ? accent : "var(--muted-foreground)"} />
                    <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? accent : "var(--muted-foreground)", whiteSpace: "nowrap" }}>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Height */}
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">
              Cut height <span className="normal-case tracking-normal font-normal">(default 3.5")</span>
            </Label>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {HEIGHT_OPTIONS.map((h) => {
                const active = form.height === h;
                return (
                  <button key={h || "none"} type="button" onClick={() => set("height")(h)} style={{
                    padding: "6px 14px", borderRadius: 100, fontSize: 13, fontWeight: active ? 600 : 400,
                    border: `1.5px solid ${active ? accent : "var(--border)"}`,
                    background: active ? `color-mix(in oklch, ${accent} 10%, transparent)` : "transparent",
                    color: active ? accent : "var(--muted-foreground)", cursor: "pointer",
                    minWidth: 44, textAlign: "center",
                  }}>{h ? `${h}"` : "—"}</button>
                );
              })}
            </div>
          </div>

          {/* Bagged */}
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => set("bagged")(!form.bagged)} className="flex items-center gap-3 p-0 bg-transparent border-none cursor-pointer">
              <div style={{
                width: 40, height: 24, borderRadius: 12, position: "relative", flexShrink: 0,
                background: form.bagged ? accent : "var(--input)", transition: "background 0.15s",
              }}>
                <div style={{
                  position: "absolute", top: 2, left: form.bagged ? 18 : 2, width: 20, height: 20,
                  borderRadius: 10, background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                  transition: "left 0.15s",
                }} />
              </div>
              <span className="text-sm" style={{ color: "var(--foreground)", fontWeight: form.bagged ? 600 : 400 }}>Bagged clippings</span>
            </button>
            {daysSince != null && <span className="text-sm text-muted-foreground">{daysSince}d since last</span>}
          </div>

          {/* Date + Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => set("date")(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Notes</Label>
              <Input placeholder="Optional" value={form.notes} onChange={(e) => set("notes")(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {isEdit && !deleting && <Button variant="destructive" onClick={() => setDeleting(true)} disabled={busy} className="sm:mr-auto">Delete</Button>}
          {isEdit && deleting && <Button variant="destructive" onClick={handleDelete} disabled={busy} className="sm:mr-auto">Confirm delete</Button>}
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy || !form.pattern} style={{ background: form.pattern ? accent : undefined }}>
            {busy ? "Saving…" : isEdit ? "Save" : "Log it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MowingLogPage({ log, entries, isLoading, autoOpen }: { log: Log; entries: LogEntry[]; isLoading: boolean; autoOpen?: boolean }) {
  const accent = log.color ?? "oklch(50% 0.15 140)";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LogEntry | null>(null);

  function openAdd() { setEditingEntry(null); setDialogOpen(true); }
  function openEdit(e: LogEntry) { setEditingEntry(e); setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditingEntry(null); }

  // Auto-open the add dialog when navigated here from a routine completion
  useEffect(() => { if (autoOpen && !isLoading) openAdd(); }, [autoOpen, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Season groups: group by year, newest first
  const seasons = useMemo(() => {
    const byYear = new Map<string, LogEntry[]>();
    for (const e of entries) {
      const yr = e.loggedAt.slice(0, 4);
      if (!byYear.has(yr)) byYear.set(yr, []);
      byYear.get(yr)!.push(e);
    }
    return [...byYear.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, list]) => ({ year, list: list.sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)) }));
  }, [entries]);

  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const sorted = [...entries].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));

    // Fav day of week
    const dayCounts = Array(7).fill(0) as number[];
    for (const e of entries) dayCounts[new Date(e.loggedAt + "T00:00:00").getDay()]++;
    const favIdx = dayCounts.indexOf(Math.max(...dayCounts));
    const favDay = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][favIdx]!;

    // Bagged %
    const baggedCount = entries.filter(e => {
      const d: Record<string,unknown> = e.data ? JSON.parse(e.data) : {};
      return Boolean(d.bagged);
    }).length;

    // Days since last
    let daysSinceLast: number | null = null;
    if (sorted[0]) {
      const d = Math.round((Date.now() - new Date(sorted[0].loggedAt + "T00:00:00").getTime()) / 86400000);
      daysSinceLast = d >= 0 ? d : null;
    }

    // Season avg interval (in-season only per season)
    const seasonAvg = (list: LogEntry[]) => {
      const gaps = list.filter(e => e.numericValue != null && e.numericValue > 0 && e.numericValue <= 25);
      return gaps.length ? gaps.reduce((s, e) => s + e.numericValue!, 0) / gaps.length : null;
    };

    return { favDay, baggedCount, baggedPct: Math.round(baggedCount / entries.length * 100), daysSinceLast, seasonAvg };
  }, [entries]);

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Header */}
      <div style={{ padding: "32px 16px 16px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 30, lineHeight: 1.15, letterSpacing: "-0.02em", color: "var(--ink)", margin: "0 0 12px" }}>
          🌿 {log.name}
        </h1>
        {stats && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {stats.daysSinceLast != null && (
              <span style={{
                fontSize: 12, padding: "4px 10px", borderRadius: 100,
                background: stats.daysSinceLast >= 10 ? "oklch(90% 0.08 80)" : "var(--bg-sunken)",
                color: stats.daysSinceLast >= 10 ? "oklch(45% 0.12 80)" : "var(--ink-3)",
                fontWeight: 500,
              }}>Last: {stats.daysSinceLast}d ago</span>
            )}
            {seasons[0] && (
              <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 100, background: "var(--bg-sunken)", color: "var(--ink-3)", fontWeight: 500 }}>
                {seasons[0].year}: {seasons[0].list.length} mow{seasons[0].list.length !== 1 ? "s" : ""}{stats.seasonAvg && (() => { const a = stats.seasonAvg!(seasons[0].list); return a != null ? ` · avg ${a.toFixed(1)}d` : ""; })()}
              </span>
            )}
            {seasons[1] && (
              <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 100, background: "var(--bg-sunken)", color: "var(--ink-4)", fontWeight: 400 }}>
                {seasons[1].year}: {seasons[1].list.length} mow{seasons[1].list.length !== 1 ? "s" : ""}
              </span>
            )}
            <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 100, background: "var(--bg-sunken)", color: "var(--ink-4)" }}>
              Usually {stats.favDay}
            </span>
            {stats.baggedPct > 0 && (
              <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 100, background: "var(--bg-sunken)", color: "var(--ink-4)" }}>
                Bagged {stats.baggedPct}%
              </span>
            )}
          </div>
        )}
      </div>

      {entries.length > 0 && (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <RotationCard entries={entries} accent={accent} />
          {seasons.length > 0 && <SeasonTimeline seasons={seasons} accent={accent} />}
        </div>
      )}

      {/* Season-grouped entries */}
      <div style={{ padding: "0 16px" }}>
        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} style={{ height: 56, background: "var(--surface)", borderRadius: 10, marginBottom: 6, opacity: 0.5 }} />)
        ) : entries.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--ink-4)", margin: "0 0 16px" }}>No mowing sessions yet.</p>
            <Button onClick={openAdd} variant="outline" size="sm">Log first mow</Button>
          </div>
        ) : (
          seasons.map(({ year, list }) => (
            <div key={year} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                {year} Season · {list.length} mow{list.length !== 1 ? "s" : ""}
              </div>
              <div style={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 16, overflow: "hidden" }}>
                {list.map((entry, i) => (
                  <MowingRow key={entry.id} entry={entry} onClick={() => openEdit(entry)} isFirstOfSeason={i === list.length - 1} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <button onClick={openAdd} style={{
        position: "fixed", bottom: 28, right: 24, zIndex: 20,
        display: "flex", alignItems: "center", gap: 8,
        padding: "12px 20px", borderRadius: 100, fontSize: 15, fontWeight: 600,
        background: accent, color: "white", border: "none",
        boxShadow: `0 4px 20px color-mix(in oklch, ${accent} 50%, transparent)`,
        cursor: "pointer",
      }}>
        <span>🌿</span>
        <span>Log mow</span>
      </button>

      <MowingDialog open={dialogOpen} onClose={closeDialog} log={log} entry={editingEntry} entries={entries} />
    </div>
  );
}

// ─── Generic log page (custom) ────────────────────────────────────────────────

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ background: "var(--bg-sunken)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: highlight ? 600 : 400, color: highlight ? "var(--accent)" : "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}


function GenericSparkLine({ entries, color }: { entries: LogEntry[]; color: string }) {
  const values = entries.filter((e) => e.numericValue != null).map((e) => e.numericValue!).reverse();
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 200; const h = 48;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GenericLogEntryDialog({
  open, onClose, log, entry,
}: { open: boolean; onClose: () => void; log: Log; entry: LogEntry | null; entries: LogEntry[] }) {
  const createEntry = useCreateLogEntry(log.id);
  const updateEntry = useUpdateLogEntry(log.id);
  const deleteEntry = useDeleteLogEntry(log.id);
  const submittedRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [genericValue, setGenericValue] = useState("");

  useEffect(() => {
    if (entry) {
      setDate(entry.loggedAt);
      setNotes(entry.notes ?? "");
      setGenericValue(entry.numericValue != null ? String(entry.numericValue) : "");
    } else {
      setDate(todayStr()); setNotes(""); setGenericValue("");
    }
    setDeleting(false);
  }, [entry?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    try {
      const numericValue = genericValue ? parseFloat(genericValue) : null;
      const payload = { loggedAt: date, numericValue, notes: notes.trim() || undefined };
      if (entry) { await updateEntry.mutateAsync({ entryId: entry.id, ...payload }); }
      else { await createEntry.mutateAsync(payload); }
      onClose();
    } finally { submittedRef.current = false; }
  }

  async function handleDelete() {
    if (!entry || submittedRef.current) return;
    submittedRef.current = true;
    try { await deleteEntry.mutateAsync(entry.id); onClose(); }
    finally { submittedRef.current = false; }
  }

  const busy = createEntry.isPending || updateEntry.isPending || deleteEntry.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{entry ? `Edit ${log.name} Entry` : `Log ${log.name}`}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entry-date">Date</Label>
            <Input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Value (optional)</Label>
            <Input type="number" value={genericValue} onChange={(e) => setGenericValue(e.target.value)} placeholder="0" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          {entry && !deleting && <Button variant="destructive" onClick={() => setDeleting(true)} disabled={busy} className="mr-auto">Delete</Button>}
          {deleting && <Button variant="destructive" onClick={handleDelete} disabled={busy} className="mr-auto">Confirm delete</Button>}
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy || !date}>{entry ? "Save" : "Log it"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenericLogPage({ log, entries, isLoading }: { log: Log; entries: LogEntry[]; isLoading: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LogEntry | null>(null);

  function openAdd() { setEditingEntry(null); setDialogOpen(true); }
  function openEdit(e: LogEntry) { setEditingEntry(e); setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditingEntry(null); }

  const valuesWithData = entries.filter((e) => e.numericValue != null);
  const avg = valuesWithData.length > 0 ? valuesWithData.reduce((s, e) => s + e.numericValue!, 0) / valuesWithData.length : null;
  const avgLabel = "Average";

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "32px 16px 20px 16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 30, lineHeight: 1.15, letterSpacing: "-0.02em", color: "var(--ink)", margin: "0 0 4px 0" }}>
            {log.icon ?? "📋"} {log.name}
          </h1>
          {log.description && <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>{log.description}</p>}
        </div>
        <Button onClick={openAdd} size="sm" style={{ marginTop: 6 }}>+ Log</Button>
      </div>

      {entries.length > 0 && (
        <div style={{ padding: "0 16px 24px 16px", display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Total entries</div>
            <div style={{ fontSize: 28, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>{entries.length}</div>
          </div>
          {avg != null && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 12, padding: "14px 18px" }}>
              <div style={{ fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{avgLabel}</div>
              <div style={{ fontSize: 28, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: log.color ?? "var(--accent)" }}>{avg.toFixed(1)}</div>
            </div>
          )}
          {valuesWithData.length >= 2 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 12, padding: "14px 18px" }}>
              <div style={{ fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Trend</div>
              <GenericSparkLine entries={entries} color={log.color ?? "var(--accent)"} />
            </div>
          )}
        </div>
      )}

      <div style={{ padding: "0 16px" }}>
        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} style={{ height: 80, background: "var(--surface)", borderRadius: 12, marginBottom: 8, opacity: 0.5 }} />)
        ) : entries.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--ink-4)", margin: "0 0 16px 0" }}>No entries yet.</p>
            <Button onClick={openAdd} variant="outline" size="sm">Log first entry</Button>
          </div>
        ) : (
          entries.map((entry) => {
            const data: Record<string, unknown> = entry.data ? JSON.parse(entry.data) : {};
            return (
              <button key={entry.id} onClick={() => openEdit(entry)} style={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 12, padding: "14px 16px", marginBottom: 8, width: "100%", textAlign: "left", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{formatDate(entry.loggedAt)}</span>
                  {entry.numericValue != null && <span style={{ fontSize: 12, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{entry.numericValue}d</span>}
                </div>
                {entry.notes && <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-3)" }}>{entry.notes}</div>}
              </button>
            );
          })
        )}
      </div>

      <GenericLogEntryDialog open={dialogOpen} onClose={closeDialog} log={log} entry={editingEntry} entries={entries} />
    </div>
  );
}

// ─── Maintenance log ──────────────────────────────────────────────────────────

const SERVICE_TYPES = [
  { key: "oil_change",      label: "Oil Change",      icon: "🛢️" },
  { key: "tire_rotation",   label: "Tire Rotation",   icon: "🔄" },
  { key: "brakes",          label: "Brakes",          icon: "🛑" },
  { key: "battery",         label: "Battery",         icon: "🔋" },
  { key: "registration",    label: "Registration",    icon: "📋" },
  { key: "car_wash",        label: "Car Wash",        icon: "🚿" },
  { key: "hvac_filter",     label: "HVAC Filter",     icon: "💨" },
  { key: "other",           label: "Other",           icon: "🔧" },
] as const;
type ServiceKey = typeof SERVICE_TYPES[number]["key"];

function serviceLabel(key: string | undefined): string {
  return SERVICE_TYPES.find((s) => s.key === key)?.label ?? key ?? "Service";
}
function serviceIcon(key: string | undefined): string {
  return SERVICE_TYPES.find((s) => s.key === key)?.icon ?? "🔧";
}

interface MaintenanceForm {
  type: ServiceKey;
  date: string;
  mileage: string;
  shop: string;
  cost: string;
  notes: string;
}

function maintenanceDefaults(suggestedType: ServiceKey = "oil_change"): MaintenanceForm {
  return { type: suggestedType, date: todayStr(), mileage: "", shop: "", cost: "", notes: "" };
}

function MaintenanceDialog({ open, onClose, log, entry, suggestedType }: {
  open: boolean; onClose: () => void; log: Log; entry: LogEntry | null; suggestedType?: ServiceKey;
}) {
  const accent = log.color ?? "oklch(55% 0.18 250)";
  const createEntry = useCreateLogEntry(log.id);
  const updateEntry = useUpdateLogEntry(log.id);
  const deleteEntry = useDeleteLogEntry(log.id);
  const submittedRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<MaintenanceForm>(() => maintenanceDefaults(suggestedType));

  useEffect(() => {
    if (open) {
      if (entry) {
        const data: Record<string, unknown> = entry.data ? JSON.parse(entry.data) : {};
        setForm({
          type: (data.type as ServiceKey) ?? "other",
          date: entry.loggedAt,
          mileage: data.mileage != null ? String(data.mileage) : "",
          shop: String(data.shop ?? ""),
          cost: data.cost != null ? String(data.cost) : "",
          notes: entry.notes ?? "",
        });
      } else {
        setForm(maintenanceDefaults(suggestedType));
      }
      setDeleting(false);
    }
  }, [open, entry?.id, suggestedType]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof MaintenanceForm>(k: K) => (v: MaintenanceForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit() {
    if (submittedRef.current || !form.date) return;
    submittedRef.current = true;
    try {
      const data: Record<string, unknown> = { type: form.type };
      if (form.mileage) data.mileage = parseInt(form.mileage);
      if (form.shop.trim()) data.shop = form.shop.trim();
      if (form.cost) data.cost = parseFloat(form.cost);
      const payload = { loggedAt: form.date, numericValue: form.mileage ? parseInt(form.mileage) : null, data, notes: form.notes.trim() || undefined };
      if (entry) { await updateEntry.mutateAsync({ entryId: entry.id, ...payload }); }
      else { await createEntry.mutateAsync(payload); }
      onClose();
    } finally { submittedRef.current = false; }
  }

  async function handleDelete() {
    if (!entry || submittedRef.current) return;
    submittedRef.current = true;
    try { await deleteEntry.mutateAsync(entry.id); onClose(); }
    finally { submittedRef.current = false; }
  }

  const busy = createEntry.isPending || updateEntry.isPending || deleteEntry.isPending;

  const bigInputStyle: React.CSSProperties = {
    fontSize: 24, fontWeight: 500, fontVariantNumeric: "tabular-nums",
    height: 56, borderRadius: 10, border: "1.5px solid var(--border)",
    background: "var(--muted)", color: "var(--foreground)",
    padding: "0 14px", width: "100%", outline: "none",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit service record" : "Log service"}</DialogTitle>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Service type */}
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Service type</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {SERVICE_TYPES.map((s) => {
                const active = form.type === s.key;
                return (
                  <button key={s.key} type="button" onClick={() => set("type")(s.key)} style={{
                    borderRadius: 10, padding: "8px 4px", cursor: "pointer",
                    border: `1.5px solid ${active ? accent : "var(--border)"}`,
                    background: active ? `color-mix(in oklch, ${accent} 10%, transparent)` : "var(--muted)",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    transition: "border-color 0.1s, background 0.1s",
                  }}>
                    <span style={{ fontSize: 16 }}>{s.icon}</span>
                    <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, color: active ? accent : "var(--muted-foreground)", lineHeight: 1.2, textAlign: "center" }}>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mileage */}
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Odometer</Label>
            <input
              inputMode="numeric"
              placeholder="52,400"
              value={form.mileage}
              onChange={(e) => set("mileage")(e.target.value)}
              style={bigInputStyle}
              autoFocus
            />
          </div>

          {/* Shop + Cost side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="flex flex-col gap-1.5">
              <Label>Shop / Location</Label>
              <Input placeholder="Jiffy Lube, Costco…" value={form.shop} onChange={(e) => set("shop")(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Cost</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input type="number" placeholder="0.00" value={form.cost} onChange={(e) => set("cost")(e.target.value)} className="pl-6" />
              </div>
            </div>
          </div>

          {/* Date + Notes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="flex flex-col gap-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => set("date")(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Notes</Label>
              <Input placeholder="Optional" value={form.notes} onChange={(e) => set("notes")(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {entry && !deleting && <Button variant="destructive" onClick={() => setDeleting(true)} disabled={busy} className="sm:mr-auto">Delete</Button>}
          {entry && deleting && <Button variant="destructive" onClick={handleDelete} disabled={busy} className="sm:mr-auto">Confirm delete</Button>}
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy || !form.date} style={{ background: accent, color: "white", border: "none" }}>
            {busy ? "Saving…" : entry ? "Save" : "Log it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MaintenanceRow({ entry, onClick }: { entry: LogEntry; onClick: () => void }) {
  const data = useMemo<Record<string, unknown>>(() => entry.data ? JSON.parse(entry.data) : {}, [entry.data]);
  const type = data.type as string | undefined;
  const mileage = data.mileage as number | undefined;
  const shop = data.shop as string | undefined;
  const cost = data.cost as number | undefined;
  const d = new Date(entry.loggedAt + "T00:00:00");
  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const yearStr = d.getFullYear().toString();
  const pillStyle: React.CSSProperties = { fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "var(--muted)", color: "var(--muted-foreground)", fontWeight: 500 };

  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
      width: "100%", textAlign: "left", cursor: "pointer",
      background: "none", border: "none", borderBottom: "1px solid var(--border)",
    }}>
      <div style={{ fontSize: 20, width: 28, textAlign: "center", flexShrink: 0 }}>{serviceIcon(type)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 2 }}>{serviceLabel(type)}</div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          {dateStr}, {yearStr}{shop ? ` · ${shop}` : ""}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {mileage != null && <span style={pillStyle}>{mileage.toLocaleString()} mi</span>}
        {cost != null && <span style={{ ...pillStyle, color: "var(--foreground)", fontWeight: 600 }}>${cost.toFixed(0)}</span>}
      </div>
    </button>
  );
}

function MaintenanceLogPage({ log, entries, isLoading, autoOpen }: { log: Log; entries: LogEntry[]; isLoading: boolean; autoOpen?: boolean }) {
  const accent = log.color ?? "oklch(55% 0.18 250)";
  const searchParams = useSearchParams();
  const suggestedType = (searchParams.get("type") as ServiceKey | null) ?? "oil_change";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LogEntry | null>(null);

  const openAdd = useCallback((type?: ServiceKey) => { setEditingEntry(null); setDialogOpen(true); }, []);
  const openEdit = (e: LogEntry) => { setEditingEntry(e); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditingEntry(null); };

  useEffect(() => { if (autoOpen && !isLoading) openAdd(); }, [autoOpen, isLoading, openAdd]);

  // Group entries by service type
  const grouped = useMemo(() => {
    const map = new Map<string, LogEntry[]>();
    for (const e of entries) {
      const data: Record<string, unknown> = e.data ? JSON.parse(e.data) : {};
      const type = (data.type as string) ?? "other";
      if (!map.has(type)) map.set(type, []);
      map.get(type)!.push(e);
    }
    return map;
  }, [entries]);

  // Stats: last oil change, total cost
  const totalCost = useMemo(() => {
    return entries.reduce((sum, e) => {
      const data: Record<string, unknown> = e.data ? JSON.parse(e.data) : {};
      return sum + ((data.cost as number) ?? 0);
    }, 0);
  }, [entries]);

  const lastOilChange = useMemo(() => {
    const oils = entries.filter((e) => {
      const d: Record<string, unknown> = e.data ? JSON.parse(e.data) : {};
      return d.type === "oil_change";
    }).sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
    return oils[0] ?? null;
  }, [entries]);

  const daysSinceLast = lastOilChange
    ? Math.round((Date.now() - new Date(lastOilChange.loggedAt + "T00:00:00").getTime()) / 86400000)
    : null;

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Header */}
      <div style={{ padding: "32px 16px 16px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 30, letterSpacing: "-0.02em", color: "var(--ink)", margin: "0 0 12px" }}>
          🔧 {log.name}
        </h1>
        {entries.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 100, background: "var(--muted)", color: "var(--muted-foreground)", fontWeight: 500 }}>
              {entries.length} records
            </span>
            {totalCost > 0 && (
              <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 100, background: "var(--muted)", color: "var(--muted-foreground)", fontWeight: 500 }}>
                ${totalCost.toFixed(0)} total
              </span>
            )}
            {daysSinceLast != null && (
              <span style={{
                fontSize: 12, padding: "4px 10px", borderRadius: 100, fontWeight: 500,
                background: daysSinceLast > 90 ? "oklch(90% 0.08 80)" : "var(--muted)",
                color: daysSinceLast > 90 ? "oklch(45% 0.12 80)" : "var(--muted-foreground)",
              }}>
                Oil: {daysSinceLast}d ago
              </span>
            )}
          </div>
        )}
      </div>

      {/* Entry list, grouped by service type */}
      <div style={{ padding: "0 16px" }}>
        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} style={{ height: 64, background: "var(--surface)", borderRadius: 12, marginBottom: 8, opacity: 0.5 }} />)
        ) : entries.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 16px" }}>No service records yet.</p>
            <Button onClick={() => openAdd()} variant="outline" size="sm">Log first service</Button>
          </div>
        ) : (
          SERVICE_TYPES.filter((s) => grouped.has(s.key)).map(({ key, label }) => (
            <div key={key} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                {label} · {grouped.get(key)!.length}
              </div>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
                {grouped.get(key)!
                  .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
                  .map((e) => <MaintenanceRow key={e.id} entry={e} onClick={() => openEdit(e)} />)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <button onClick={() => openAdd()} style={{
        position: "fixed", bottom: 28, right: 24, zIndex: 20,
        display: "flex", alignItems: "center", gap: 8,
        padding: "12px 20px", borderRadius: 100, fontSize: 15, fontWeight: 600,
        background: accent, color: "white", border: "none",
        boxShadow: `0 4px 20px color-mix(in oklch, ${accent} 50%, transparent)`,
        cursor: "pointer",
      }}>
        <span>🔧</span><span>Log service</span>
      </button>

      <MaintenanceDialog open={dialogOpen} onClose={closeDialog} log={log} entry={editingEntry} suggestedType={suggestedType} />
    </div>
  );
}

// ─── Health log ───────────────────────────────────────────────────────────────

const VISIT_TYPES = [
  { key: "doctor",    label: "Doctor",      icon: "🩺" },
  { key: "dental",    label: "Dental",      icon: "🦷" },
  { key: "eye_exam",  label: "Eye Exam",    icon: "👁️" },
  { key: "urgent",    label: "Urgent Care", icon: "🚑" },
  { key: "other",     label: "Other",       icon: "💊" },
] as const;
type VisitKey = typeof VISIT_TYPES[number]["key"];

function visitLabel(key: string | undefined): string {
  return VISIT_TYPES.find((v) => v.key === key)?.label ?? key ?? "Visit";
}
function visitIcon(key: string | undefined): string {
  return VISIT_TYPES.find((v) => v.key === key)?.icon ?? "💊";
}

interface HealthForm {
  type: VisitKey;
  date: string;
  provider: string;
  location: string;
  cost: string;
  notes: string;
}

function healthDefaults(suggestedType: VisitKey = "doctor"): HealthForm {
  return { type: suggestedType, date: todayStr(), provider: "", location: "", cost: "", notes: "" };
}

function HealthDialog({ open, onClose, log, entry, suggestedType }: {
  open: boolean; onClose: () => void; log: Log; entry: LogEntry | null; suggestedType?: VisitKey;
}) {
  const accent = log.color ?? "#ef4444";
  const createEntry = useCreateLogEntry(log.id);
  const updateEntry = useUpdateLogEntry(log.id);
  const deleteEntry = useDeleteLogEntry(log.id);
  const submittedRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<HealthForm>(() => healthDefaults(suggestedType));

  useEffect(() => {
    if (open) {
      if (entry) {
        const data: Record<string, unknown> = entry.data ? JSON.parse(entry.data) : {};
        setForm({
          type: (data.type as VisitKey) ?? "doctor",
          date: entry.loggedAt,
          provider: String(data.provider ?? ""),
          location: String(data.location ?? ""),
          cost: data.cost != null ? String(data.cost) : "",
          notes: entry.notes ?? "",
        });
      } else {
        setForm(healthDefaults(suggestedType));
      }
      setDeleting(false);
    }
  }, [open, entry?.id, suggestedType]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof HealthForm>(k: K) => (v: HealthForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit() {
    if (submittedRef.current || !form.date) return;
    submittedRef.current = true;
    try {
      const data: Record<string, unknown> = { type: form.type };
      if (form.provider.trim()) data.provider = form.provider.trim();
      if (form.location.trim()) data.location = form.location.trim();
      if (form.cost) data.cost = parseFloat(form.cost);
      const payload = { loggedAt: form.date, numericValue: null, data, notes: form.notes.trim() || undefined };
      if (entry) { await updateEntry.mutateAsync({ entryId: entry.id, ...payload }); }
      else { await createEntry.mutateAsync(payload); }
      onClose();
    } finally { submittedRef.current = false; }
  }

  async function handleDelete() {
    if (!entry || submittedRef.current) return;
    submittedRef.current = true;
    try { await deleteEntry.mutateAsync(entry.id); onClose(); }
    finally { submittedRef.current = false; }
  }

  const busy = createEntry.isPending || updateEntry.isPending || deleteEntry.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit visit" : "Log visit"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          {/* Visit type */}
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Type</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {VISIT_TYPES.map((v) => {
                const active = form.type === v.key;
                return (
                  <button key={v.key} type="button" onClick={() => set("type")(v.key)} style={{
                    border: `2px solid ${active ? accent : "var(--hairline)"}`,
                    borderRadius: 10, cursor: "pointer", display: "flex",
                    flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                    height: 64, padding: "0 4px",
                    background: active ? `color-mix(in oklch, ${accent} 10%, transparent)` : "var(--bg-sunken)",
                  }}>
                    <span style={{ fontSize: 20 }}>{v.icon}</span>
                    <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, color: active ? accent : "var(--muted-foreground)", whiteSpace: "nowrap" }}>{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Provider + Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Provider</Label>
              <Input placeholder="Dr. Smith" value={form.provider} onChange={(e) => set("provider")(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Location</Label>
              <Input placeholder="UW Health" value={form.location} onChange={(e) => set("location")(e.target.value)} />
            </div>
          </div>

          {/* Date + Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => set("date")(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Cost (out of pocket)</Label>
              <Input type="number" placeholder="0.00" step="0.01" value={form.cost} onChange={(e) => set("cost")(e.target.value)} />
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <textarea
              placeholder="Reason, outcome, Rx..."
              value={form.notes}
              onChange={(e) => set("notes")(e.target.value)}
              rows={3}
              style={{ width: "100%", borderRadius: 6, border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", fontSize: 14, padding: "8px 10px", outline: "none", resize: "vertical", fontFamily: "inherit" }}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {entry && !deleting && <Button variant="destructive" onClick={() => setDeleting(true)} disabled={busy} className="sm:mr-auto">Delete</Button>}
          {entry && deleting && <Button variant="destructive" onClick={handleDelete} disabled={busy} className="sm:mr-auto">Confirm delete</Button>}
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy || !form.date} style={{ background: accent }}>
            {busy ? "Saving…" : entry ? "Save" : "Log it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HealthRow({ entry, onClick }: { entry: LogEntry; onClick: () => void }) {
  const data: Record<string, unknown> = entry.data ? JSON.parse(entry.data) : {};
  const type = data.type as string | undefined;
  const provider = data.provider as string | undefined;
  const location = data.location as string | undefined;
  const cost = data.cost as number | undefined;

  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
      width: "100%", textAlign: "left", cursor: "pointer",
      background: "none", border: "none", borderBottom: "1px solid var(--hairline)",
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg-sunken)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
        {visitIcon(type)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{visitLabel(type)}</div>
        <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {provider ?? location ?? ""}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500 }}>{formatDateShort(entry.loggedAt)}</div>
        {cost != null && cost > 0 && (
          <div style={{ fontSize: 11, color: "var(--ink-4)", fontVariantNumeric: "tabular-nums" }}>${cost.toFixed(2)}</div>
        )}
      </div>
    </button>
  );
}

function HealthLogPage({ log, entries, isLoading, autoOpen }: { log: Log; entries: LogEntry[]; isLoading: boolean; autoOpen?: boolean }) {
  const accent = log.color ?? "#ef4444";
  const searchParams = useSearchParams();
  const typeParam = (searchParams.get("type") as VisitKey | null) ?? "doctor";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LogEntry | null>(null);
  const [suggestedType, setSuggestedType] = useState<VisitKey>(typeParam);

  const openAdd = useCallback((type: VisitKey = typeParam) => { setSuggestedType(type); setEditingEntry(null); setDialogOpen(true); }, [typeParam]); // eslint-disable-line react-hooks/exhaustive-deps
  const openEdit = (e: LogEntry) => { setEditingEntry(e); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditingEntry(null); };

  useEffect(() => { if (autoOpen && !isLoading) openAdd(); }, [autoOpen, isLoading, openAdd]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(() => [...entries].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)), [entries]);

  // Group by type
  const grouped = useMemo(() => {
    const m = new Map<string, LogEntry[]>();
    for (const e of entries) {
      const data: Record<string, unknown> = e.data ? JSON.parse(e.data) : {};
      const key = String(data.type ?? "other");
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    }
    return m;
  }, [entries]);

  const totalCost = useMemo(() => {
    return entries.reduce((s, e) => {
      const data: Record<string, unknown> = e.data ? JSON.parse(e.data) : {};
      return s + (typeof data.cost === "number" ? data.cost : 0);
    }, 0);
  }, [entries]);

  const lastEntry = sorted[0];
  const lastData: Record<string, unknown> = lastEntry?.data ? JSON.parse(lastEntry.data) : {};

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Header */}
      <div style={{ padding: "32px 16px 16px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 30, lineHeight: 1.15, letterSpacing: "-0.02em", color: "var(--ink)", margin: "0 0 12px" }}>
          🏥 {log.name}
        </h1>
        {entries.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 100, background: "var(--bg-sunken)", color: "var(--ink-3)", fontWeight: 500 }}>
              {entries.length} visit{entries.length !== 1 ? "s" : ""}
            </span>
            {lastEntry && (
              <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 100, background: "var(--bg-sunken)", color: "var(--ink-3)", fontWeight: 500 }}>
                Last: {visitIcon(lastData.type as string)} {formatDate(lastEntry.loggedAt)}
              </span>
            )}
            {totalCost > 0 && (
              <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 100, background: "var(--bg-sunken)", color: "var(--ink-4)" }}>
                ${totalCost.toFixed(2)} out of pocket
              </span>
            )}
          </div>
        )}
      </div>

      {/* Quick-add type buttons */}
      <div style={{ padding: "0 16px 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {VISIT_TYPES.map((v) => (
          <button key={v.key} onClick={() => openAdd(v.key)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 100, fontSize: 12, fontWeight: 500,
            border: "1.5px solid var(--hairline)", background: "var(--surface)",
            color: "var(--ink-3)", cursor: "pointer",
          }}>
            <span>{v.icon}</span><span>{v.label}</span>
          </button>
        ))}
      </div>

      {/* By type, newest-first within each type */}
      <div style={{ padding: "0 16px" }}>
        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} style={{ height: 64, background: "var(--surface)", borderRadius: 12, marginBottom: 8, opacity: 0.5 }} />)
        ) : entries.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--ink-4)", margin: "0 0 16px" }}>No visits logged yet.</p>
            <Button onClick={() => openAdd()} variant="outline" size="sm">Log first visit</Button>
          </div>
        ) : (
          VISIT_TYPES.filter((v) => grouped.has(v.key)).map(({ key, label }) => (
            <div key={key} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                {label} · {grouped.get(key)!.length}
              </div>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
                {grouped.get(key)!
                  .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
                  .map((e) => <HealthRow key={e.id} entry={e} onClick={() => openEdit(e)} />)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <button onClick={() => openAdd()} style={{
        position: "fixed", bottom: 28, right: 24, zIndex: 20,
        display: "flex", alignItems: "center", gap: 8,
        padding: "12px 20px", borderRadius: 100, fontSize: 15, fontWeight: 600,
        background: accent, color: "white", border: "none",
        boxShadow: `0 4px 20px color-mix(in oklch, ${accent} 50%, transparent)`,
        cursor: "pointer",
      }}>
        <span>🏥</span><span>Log visit</span>
      </button>

      <HealthDialog open={dialogOpen} onClose={closeDialog} log={log} entry={editingEntry} suggestedType={suggestedType} />
    </div>
  );
}

// ─── Route handler ────────────────────────────────────────────────────────────

export default function LogDetailPage({ params }: Props) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const autoOpen = searchParams.get("add") === "1";
  const { data: logs = [] } = useLogs();
  const log = logs.find((l) => l.slug === slug);
  const { data: entries = [], isLoading } = useLogEntries(log?.id ?? "");

  if (!log && logs.length > 0) {
    return <div style={{ padding: 32, color: "var(--ink-3)" }}>Log not found.</div>;
  }

  if (!log) {
    return (
      <div style={{ padding: 32 }}>
        {[1, 2].map((i) => <div key={i} style={{ height: 40, background: "var(--surface)", borderRadius: 10, marginBottom: 12, opacity: 0.4 }} />)}
      </div>
    );
  }

  if (slug === "gas") {
    return <GasLogPage log={log} entries={entries} isLoading={isLoading} />;
  }
  if (slug === "mowing") {
    return <MowingLogPage log={log} entries={entries} isLoading={isLoading} autoOpen={autoOpen} />;
  }
  if (slug === "maintenance") {
    return <MaintenanceLogPage log={log} entries={entries} isLoading={isLoading} autoOpen={autoOpen} />;
  }
  if (slug === "health") {
    return <HealthLogPage log={log} entries={entries} isLoading={isLoading} autoOpen={autoOpen} />;
  }

  return <GenericLogPage log={log} entries={entries} isLoading={isLoading} />;
}
