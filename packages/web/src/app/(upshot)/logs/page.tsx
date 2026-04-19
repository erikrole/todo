"use client";

import Link from "next/link";
import { useLogs } from "@/hooks/use-logs";
import { ViewHeader } from "@/components/upshot/view-header";

export default function LogsPage() {
  const { data: logs = [], isLoading } = useLogs();

  return (
    <div style={{ maxWidth: 640 }}>
      <ViewHeader title="Logs" subtitle="Track what matters over time" />
      {isLoading ? (
        <div style={{ padding: "0 16px" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 72, background: "var(--surface)", borderRadius: 12, marginBottom: 10, opacity: 0.5 }} />
          ))}
        </div>
      ) : (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {logs.map((log) => (
            <Link
              key={log.id}
              href={`/logs/${log.slug}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 16px",
                background: "var(--surface)",
                borderRadius: 12,
                border: "1px solid var(--hairline)",
                textDecoration: "none",
                color: "var(--ink)",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: log.color ? `${log.color}22` : "var(--surface-2)",
                  border: `1px solid ${log.color ? `${log.color}44` : "var(--hairline)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                {log.icon ?? "📋"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{log.name}</div>
                {log.description && (
                  <div style={{ fontSize: 12, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.description}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: log.color ?? "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
                  {log.entryCount}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-4)" }}>entries</div>
              </div>
            </Link>
          ))}
          {logs.length === 0 && (
            <div style={{ padding: "48px 0", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>No logs yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
