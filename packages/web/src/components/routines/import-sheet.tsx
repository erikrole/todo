"use client";

import { useState, useRef } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/fetch";
import { useQueryClient } from "@tanstack/react-query";
import type { Task } from "@todo/shared";

interface ParsedTask {
  name: string;
  completions: Array<{ completedAt: string; notes: string | undefined }>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseCSV(raw: string): ParsedTask[] {
  const lines = raw.trim().split("\n");
  const map = new Map<string, Array<{ completedAt: string; notes: string | undefined }>>();

  for (const line of lines) {
    if (!line.trim() || line.startsWith("task,")) continue;
    const cols = line.split(",");
    const taskName = cols[0]?.trim();
    const dateStr = cols[2]?.trim();
    const notes = cols[4]?.trim() || undefined;
    if (!taskName || !dateStr) continue;
    const completedAt = dateStr.replace(" ", "T");
    if (!map.has(taskName)) map.set(taskName, []);
    map.get(taskName)!.push({ completedAt, notes });
  }

  return Array.from(map.entries()).map(([name, completions]) => ({
    name,
    completions: completions.sort((a, b) => a.completedAt.localeCompare(b.completedAt)),
  }));
}

export function ImportSheet({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<"paste" | "preview" | "importing">("paste");
  const [csvText, setCsvText] = useState("");
  const [parsed, setParsed] = useState<ParsedTask[]>([]);
  const [progress, setProgress] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  function handleParse() {
    const result = parseCSV(csvText);
    if (result.length === 0) {
      setProgress("No tasks found in CSV. Check the format.");
      return;
    }
    setParsed(result);
    setStep("preview");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText((ev.target?.result as string) ?? "");
    reader.readAsText(file);
  }

  async function handleImport() {
    setStep("importing");
    let totalImported = 0;

    const all = await api.get<Task[]>("/api/tasks?filter=all");

    for (const pt of parsed) {
      setProgress(`Importing ${pt.name}...`);
      try {
        // Find existing task by title
        let task = all.find((t) => t.title === pt.name && t.recurrenceType);

        // Create if not found
        if (!task) {
          task = await api.post<Task>("/api/tasks", {
            title: pt.name,
            recurrenceType: "weekly",
            recurrenceMode: "after_completion",
            recurrenceInterval: 1,
          });
        }

        // Import completions
        const result = await api.post<{ inserted: number }>(
          `/api/tasks/${task.id}/completions/import`,
          {
            completions: pt.completions.map((c) => ({
              completedAt: c.completedAt,
              notes: c.notes ?? undefined,
            })),
          },
        );
        totalImported += result.inserted;
      } catch (err) {
        console.error(`Failed to import ${pt.name}:`, err);
      }
    }

    // Invalidate queries
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["task-completions"] });

    setProgress(`Done! Imported ${totalImported} completions across ${parsed.length} routines.`);
    setStep("paste");
    setParsed([]);
    setCsvText("");
  }

  function handleClose(v: boolean) {
    if (!v) {
      setStep("paste");
      setParsed([]);
      setCsvText("");
      setProgress("");
    }
    onOpenChange(v);
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-[480px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Import from Sometime</SheetTitle>
          <SheetDescription>Paste your Sometime CSV export to import completion history.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-4 flex flex-col gap-4">
          {step === "paste" && (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Paste CSV or upload file</label>
                <Textarea
                  className="font-mono text-xs h-48"
                  placeholder={"task,category,date,date_iso8601,notes,...\n🛏 Sheets,,2024-03-08 14:00:00,..."}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                />
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  Choose file...
                </Button>
              </div>
              {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
              <Button onClick={handleParse} disabled={!csvText.trim()}>
                Parse CSV
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <p className="text-sm text-muted-foreground">
                Found {parsed.length} routines,{" "}
                {parsed.reduce((s, p) => s + p.completions.length, 0)} total completions.
              </p>
              <div className="flex flex-col gap-1 text-sm border rounded-md overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 bg-muted text-xs font-medium text-muted-foreground">
                  <span>Task</span>
                  <span className="text-right">Count</span>
                  <span className="text-right">Last</span>
                </div>
                {parsed.map((pt) => {
                  const last = pt.completions[pt.completions.length - 1];
                  const lastDate = last
                    ? new Date(last.completedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—";
                  return (
                    <div
                      key={pt.name}
                      className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 border-t text-[13px]"
                    >
                      <span className="truncate">{pt.name}</span>
                      <span className="text-right text-muted-foreground font-mono tabular-nums">
                        {pt.completions.length}
                      </span>
                      <span className="text-right text-muted-foreground text-xs">{lastDate}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                ⚠ Importing will replace all existing completion history for these routines.
              </p>
              <div className="flex gap-2 mt-auto pt-2">
                <Button variant="outline" onClick={() => setStep("paste")} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleImport} className="flex-1">
                  Import All
                </Button>
              </div>
            </>
          )}

          {step === "importing" && (
            <div className="flex flex-col gap-2 items-center justify-center flex-1 text-center">
              <p className="text-sm text-muted-foreground">{progress || "Importing..."}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
