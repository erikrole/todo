"use client";

import { useRef, useState } from "react";
import { ViewHeader } from "@/components/upshot/view-header";
import { useLogs } from "@/hooks/use-logs";
import { api } from "@/lib/fetch";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportResult {
  inserted?: number;
  skipped?: number;
  tasksCreated?: number;
  completionsInserted?: number;
  total: number;
}

// ─── Gas CSV Parser ───────────────────────────────────────────────────────────

function parseGasCsv(text: string) {
  const lines = text.trim().split("\n");
  const headers = parseCsvLine(lines[0]);
  const idx = (name: string) => headers.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());

  const iDate = idx("Date (UTC)");
  const iLocation = idx("Location");
  const iTotalCost = idx("Total Cost");
  const iFuelType = idx("Fuel Type");
  const iQuantity = idx("Quantity");
  const iUnitPrice = idx("Unit Price");
  const iOdometer = idx("Odometer");
  const iFuelEconomy = idx("Fuel Economy");
  const iFuelEconomyUnit = idx("Fuel Economy Unit");
  const iFillup = idx("Fillup");

  const entries: { loggedAt: string; numericValue: number | null; data: Record<string, unknown>; notes?: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < 3) continue;

    const fillup = row[iFillup]?.trim();
    if (fillup === "No") continue;

    const dateRaw = row[iDate]?.trim();
    if (!dateRaw) continue;
    const loggedAt = dateRaw.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(loggedAt)) continue;

    const gallons = parseFloat(row[iQuantity]);
    const pricePerGallon = parseFloat(row[iUnitPrice]);
    const totalCost = parseFloat(row[iTotalCost]);
    const odometer = parseFloat(row[iOdometer]);
    const fuelEconomyRaw = row[iFuelEconomy]?.trim();
    const fuelEconomyUnit = row[iFuelEconomyUnit]?.trim();

    const numericValue =
      fuelEconomyUnit === "MPG" &&
      fuelEconomyRaw &&
      !["invalidOdometer", "noFillPrevious", "missingPrevious", "noFill"].includes(fuelEconomyRaw)
        ? parseFloat(fuelEconomyRaw) < 100
          ? parseFloat(fuelEconomyRaw)
          : null
        : null;

    const rawGrade = row[iFuelType]?.trim() ?? "";
    const grade = rawGrade.toLowerCase().replace(/[_\s]/g, " ").replace("regular gas", "regular").replace("premium gas", "premium").replace("midgrade gas", "midgrade");

    const data: Record<string, unknown> = {};
    if (!isNaN(gallons)) data.gallons = gallons;
    if (!isNaN(pricePerGallon)) data.pricePerGallon = pricePerGallon;
    if (!isNaN(totalCost)) data.totalCost = totalCost;
    if (!isNaN(odometer)) data.odometer = odometer;
    if (row[iLocation]?.trim()) data.station = row[iLocation].trim();
    if (grade) data.grade = grade;

    entries.push({ loggedAt, numericValue: numericValue ?? null, data });
  }

  return entries;
}

// ─── Mowing CSV Parser ────────────────────────────────────────────────────────

function parseMowingCsv(text: string) {
  const lines = text.trim().split("\n");
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.findIndex((h) => h === name.toLowerCase());

  const iDate = idx("date");
  const iPattern = idx("pattern");
  const iHeight = idx("height");
  const iBagged = idx("bagged");
  const iDuration = idx("duration");
  const iNotes = idx("notes");

  const entries: { loggedAt: string; data: Record<string, unknown>; notes?: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < 2) continue;

    const loggedAt = row[iDate]?.trim().slice(0, 10);
    if (!loggedAt || !/^\d{4}-\d{2}-\d{2}$/.test(loggedAt)) continue;

    const data: Record<string, unknown> = {};
    if (iPattern >= 0 && row[iPattern]?.trim()) data.pattern = row[iPattern].trim();
    if (iHeight >= 0 && row[iHeight]?.trim()) data.height = row[iHeight].trim();
    if (iBagged >= 0) data.bagged = row[iBagged]?.trim().toLowerCase() === "true" || row[iBagged]?.trim() === "1" || row[iBagged]?.trim() === "✓";
    if (iDuration >= 0 && row[iDuration]?.trim()) data.duration = row[iDuration].trim();

    const notes = iNotes >= 0 ? row[iNotes]?.trim() : undefined;
    entries.push({ loggedAt, data, notes: notes || undefined });
  }

  return entries;
}

// ─── Routines CSV Parser ──────────────────────────────────────────────────────

function parseRoutinesCsv(text: string) {
  const lines = text.trim().split("\n");
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const iTask = headers.findIndex((h) => h === "task");
  const iDate = headers.findIndex((h) => h === "date_iso8601" || h === "date");
  const iNotes = headers.findIndex((h) => h === "notes");

  const entries: { taskTitle: string; completedAt: string; notes?: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < 2) continue;

    const rawTitle = row[iTask]?.trim();
    if (!rawTitle) continue;
    // Strip leading emoji + space
    const taskTitle = rawTitle.replace(/^[\p{Emoji}\s]+/u, "").trim() || rawTitle.trim();

    const rawDate = row[iDate]?.trim();
    if (!rawDate) continue;
    const completedAt = rawDate.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(completedAt)) continue;

    const notes = iNotes >= 0 ? row[iNotes]?.trim() : undefined;
    entries.push({ taskTitle, completedAt, notes: notes || undefined });
  }

  return entries;
}

// ─── CSV line parser (handles quoted fields) ──────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const { data: logs = [] } = useLogs();

  const gasLog = logs.find((l) => l.slug === "gas");
  const mowingLog = logs.find((l) => l.slug === "mowing");

  return (
    <div style={{ maxWidth: 640 }}>
      <ViewHeader title="Import" subtitle="Bring in data from external sources" />
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <GasImportCard gasLog={gasLog} />
        <MowingImportCard mowingLog={mowingLog} />
        <RoutinesImportCard />
      </div>
    </div>
  );
}

// ─── Specialized import cards with result state ───────────────────────────────

function GasImportCard({ gasLog }: { gasLog?: { id: string } }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "previewing" | "importing" | "done" | "error">("idle");
  const [preview, setPreview] = useState<{ count: number; sample: string[] } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setFileText(text);
      const lines = text.trim().split("\n");
      setPreview({ count: lines.length - 1, sample: lines.slice(1, 4) });
      setStatus("previewing");
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!fileText) return;
    setStatus("importing");
    try {
      if (!gasLog) throw new Error('No "gas" log found. Create a log with slug "gas" first.');
      const entries = parseGasCsv(fileText);
      if (entries.length === 0) throw new Error("No valid fill-up rows found.");
      const result = await api.post<ImportResult>(`/api/logs/${gasLog.id}/entries/batch`, { entries, skipExisting: true });
      setResult(result); setStatus("done");
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed"); setStatus("error"); }
  }

  function reset() { setStatus("idle"); setPreview(null); setFileText(null); setResult(null); setError(null); if (fileRef.current) fileRef.current.value = ""; }

  return (
    <ImportCardShell title="Gas Fill-ups" icon="⛽" description="GasBuddy CSV export — skips non-fill-up rows and deduplicates by date">
      <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFile} />
      {(status === "idle" || status === "error") && (
        <button onClick={() => fileRef.current?.click()} style={chooseBtnStyle}>Choose GasBuddy CSV…</button>
      )}
      {error && <ErrorMsg>{error}</ErrorMsg>}
      {status === "previewing" && preview && (
        <PreviewBlock preview={preview} onImport={handleImport} onCancel={reset} />
      )}
      {status === "importing" && <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Importing…</div>}
      {status === "done" && result && (
        <SuccessMsg result={result} onReset={reset} />
      )}
    </ImportCardShell>
  );
}

function MowingImportCard({ mowingLog }: { mowingLog?: { id: string } }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "previewing" | "importing" | "done" | "error">("idle");
  const [preview, setPreview] = useState<{ count: number; sample: string[] } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);

  const TEMPLATE = "date,pattern,height,bagged,duration,notes\n2025-04-27,North-South,3.5,false,,\n2025-05-10,East-West,3.5,true,,";
  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setFileText(text);
      const lines = text.trim().split("\n");
      setPreview({ count: lines.length - 1, sample: lines.slice(1, 4) });
      setStatus("previewing");
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!fileText) return;
    setStatus("importing");
    try {
      if (!mowingLog) throw new Error('No "mowing" log found. Create a log with slug "mowing" first.');
      const entries = parseMowingCsv(fileText);
      if (entries.length === 0) throw new Error("No valid rows found. Check the CSV format.");
      const result = await api.post<ImportResult>(`/api/logs/${mowingLog.id}/entries/batch`, { entries, skipExisting: true });
      setResult(result); setStatus("done");
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed"); setStatus("error"); }
  }

  function reset() { setStatus("idle"); setPreview(null); setFileText(null); setResult(null); setError(null); if (fileRef.current) fileRef.current.value = ""; }

  return (
    <ImportCardShell title="Mowing Log" icon="🌿" description="CSV with date, pattern, height, bagged columns">
      <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFile} />
      {(status === "idle" || status === "error") && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => fileRef.current?.click()} style={{ ...chooseBtnStyle, flex: 1 }}>Choose CSV…</button>
          <a href={templateHref} download="mowing-template.csv" style={templateBtnStyle}>Template</a>
        </div>
      )}
      {error && <ErrorMsg>{error}</ErrorMsg>}
      {status === "previewing" && preview && (
        <PreviewBlock preview={preview} onImport={handleImport} onCancel={reset} />
      )}
      {status === "importing" && <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Importing…</div>}
      {status === "done" && result && <SuccessMsg result={result} onReset={reset} />}
    </ImportCardShell>
  );
}

function RoutinesImportCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "previewing" | "importing" | "done" | "error">("idle");
  const [preview, setPreview] = useState<{ count: number; sample: string[] } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setFileText(text);
      const lines = text.trim().split("\n");
      setPreview({ count: lines.length - 1, sample: lines.slice(1, 4) });
      setStatus("previewing");
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!fileText) return;
    setStatus("importing");
    try {
      const entries = parseRoutinesCsv(fileText);
      if (entries.length === 0) throw new Error("No valid rows found. Expected columns: task, date_iso8601.");
      const result = await api.post<ImportResult>("/api/import/routines", { completions: entries, createMissing: true });
      setResult(result); setStatus("done");
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed"); setStatus("error"); }
  }

  function reset() { setStatus("idle"); setPreview(null); setFileText(null); setResult(null); setError(null); if (fileRef.current) fileRef.current.value = ""; }

  return (
    <ImportCardShell title="Routines / Completions" icon="🔄" description="Streaks export CSV with task, date_iso8601, notes columns — creates missing routine tasks">
      <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFile} />
      {(status === "idle" || status === "error") && (
        <button onClick={() => fileRef.current?.click()} style={chooseBtnStyle}>Choose completions CSV…</button>
      )}
      {error && <ErrorMsg>{error}</ErrorMsg>}
      {status === "previewing" && preview && (
        <PreviewBlock preview={preview} onImport={handleImport} onCancel={reset} />
      )}
      {status === "importing" && <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Importing…</div>}
      {status === "done" && result && <SuccessMsg result={result} onReset={reset} />}
    </ImportCardShell>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function ImportCardShell({ title, icon, description, children }: { title: string; icon: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 14, padding: "20px 20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{description}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function PreviewBlock({ preview, onImport, onCancel }: { preview: { count: number; sample: string[] }; onImport: () => void; onCancel: () => void }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 6 }}>{preview.count} rows detected</div>
      <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--ink-3)", background: "var(--surface-2)", borderRadius: 8, padding: "8px 10px" }}>
        {preview.sample.map((l, i) => (
          <div key={i} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l}</div>
        ))}
        {preview.count > 3 && <div style={{ opacity: 0.5 }}>…</div>}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={onImport} style={{ flex: 1, padding: "9px 16px", borderRadius: 8, background: "var(--accent)", color: "#fff", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          Import {preview.count} rows
        </button>
        <button onClick={onCancel} style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--hairline)", background: "transparent", color: "var(--ink-3)", fontSize: 13, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function SuccessMsg({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 13, color: "var(--ink)", padding: "8px 12px", background: "color-mix(in srgb, var(--accent) 8%, var(--surface))", borderRadius: 8 }}>
        {result.completionsInserted != null ? (
          <>✓ {result.completionsInserted} completions imported{result.tasksCreated ? `, ${result.tasksCreated} tasks created` : ""}{result.skipped ? `, ${result.skipped} skipped` : ""}</>
        ) : (
          <>✓ {result.inserted} entries imported{result.skipped ? `, ${result.skipped} skipped (duplicates)` : ""}</>
        )}
      </div>
      <button onClick={onReset} style={{ alignSelf: "flex-start", padding: "6px 12px", borderRadius: 8, border: "1px solid var(--hairline)", background: "transparent", color: "var(--ink-3)", fontSize: 12, cursor: "pointer" }}>
        Import another
      </button>
    </div>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: "#e53e3e", padding: "8px 12px", background: "color-mix(in srgb, #e53e3e 8%, var(--surface))", borderRadius: 8 }}>{children}</div>;
}

const chooseBtnStyle: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 8,
  border: "1.5px dashed var(--hairline)",
  background: "var(--surface-2)",
  color: "var(--ink-2)",
  fontSize: 13,
  cursor: "pointer",
  width: "100%",
  textAlign: "left",
};

const templateBtnStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid var(--hairline)",
  background: "transparent",
  color: "var(--ink-3)",
  fontSize: 12,
  cursor: "pointer",
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  whiteSpace: "nowrap",
};
