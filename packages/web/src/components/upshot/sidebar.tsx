"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAreas, useCreateArea } from "@/hooks/use-areas";
import { useProjects } from "@/hooks/use-projects";
import { useTaskCounts } from "@/hooks/use-tasks";
import type { Accent, Theme } from "./shell";

const AREA_COLOR_PALETTE = [
  "oklch(0.68 0.13 58)",   // ochre
  "oklch(0.63 0.13 30)",   // clay
  "oklch(0.62 0.08 150)",  // sage
  "oklch(0.58 0.08 240)",  // slate
  "oklch(0.56 0.12 320)",  // plum
];

const ACCENT_SWATCHES: { id: Accent; color: string }[] = [
  { id: "ochre", color: "oklch(0.68 0.13 58)" },
  { id: "clay",  color: "oklch(0.63 0.13 30)" },
  { id: "sage",  color: "oklch(0.62 0.08 150)" },
  { id: "slate", color: "oklch(0.58 0.08 240)" },
  { id: "plum",  color: "oklch(0.56 0.12 320)" },
];

function NavIcon({ type }: { type: string }) {
  const props = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "today") return <svg {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/></svg>;
  if (type === "inbox") return <svg {...props}><path d="M3 13h4l2 3h6l2-3h4"/><path d="M5 13l2-7h10l2 7v6H5z"/></svg>;
  if (type === "upcoming") return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>;
  if (type === "someday") return <svg {...props}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 11h16M9 4v3M15 4v3"/><path d="M12 14.5l1.8 1 .4-2.1-1.5-1.4 2.1-.3L12 10l-1 1.7 2.1.3-1.5 1.4.4 2.1z" strokeLinejoin="round" strokeWidth="1.2"/></svg>;
  if (type === "routines") return <svg {...props}><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>;
  if (type === "logbook") return <svg {...props}><path d="M4 5h16M4 10h16M4 15h10M4 20h6"/></svg>;
  if (type === "trash") return <svg {...props}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>;
  return null;
}

const NAV: { href: string; label: string; icon: string; countKey?: "inbox" | "today" | "overdue" }[] = [
  { href: "/v2/today",    label: "Today",    icon: "today",    countKey: "today" },
  { href: "/v2/inbox",    label: "Inbox",    icon: "inbox",    countKey: "inbox" },
  { href: "/v2/upcoming", label: "Upcoming", icon: "upcoming" },
  { href: "/v2/someday",  label: "Someday",  icon: "someday" },
  { href: "/v2/routines", label: "Routines", icon: "routines" },
  { href: "/v2/logbook",  label: "Logbook",  icon: "logbook" },
  { href: "/v2/trash",    label: "Trash",    icon: "trash" },
];

interface SidebarProps {
  accent: Accent;
  onAccentChange: (a: Accent) => void;
  theme: Theme;
  onThemeToggle: () => void;
}

export function UpshootSidebar({ accent, onAccentChange, theme, onThemeToggle }: SidebarProps) {
  const pathname = usePathname();
  const { data: areas = [] } = useAreas();
  const { data: allProjects = [] } = useProjects();
  const { data: counts } = useTaskCounts();
  const createArea = useCreateArea();

  const [addingArea, setAddingArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const newAreaRef = useRef<HTMLInputElement>(null);
  const newAreaSubmittedRef = useRef(false);

  useEffect(() => {
    if (addingArea) setTimeout(() => newAreaRef.current?.focus(), 30);
  }, [addingArea]);

  async function submitNewArea() {
    if (newAreaSubmittedRef.current) return;
    const name = newAreaName.trim();
    if (!name) { setAddingArea(false); return; }
    newAreaSubmittedRef.current = true;
    const color = AREA_COLOR_PALETTE[areas.length % AREA_COLOR_PALETTE.length];
    setNewAreaName("");
    setAddingArea(false);
    await createArea.mutateAsync({ name, color });
    newAreaSubmittedRef.current = false;
  }

  const topLevelProjects = allProjects.filter((p) => !p.parentProjectId && !p.isCompleted);

  return (
    <aside
      style={{
        width: 232,
        flex: "0 0 232px",
        borderRight: "1px solid var(--hairline)",
        background: "var(--bg-sunken)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
        overflow: "hidden",
      }}
    >
      {/* Brand */}
      <div style={{ padding: "18px 18px 10px 18px", display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: "var(--accent)",
            position: "relative",
            boxShadow: "inset 0 -4px 0 oklch(0 0 0 / 0.12)",
            flexShrink: 0,
          }}
        >
          <div style={{ position: "absolute", inset: 6, borderRadius: 4, background: "var(--bg-sunken)" }} />
          <div style={{ position: "absolute", left: 9, top: 9, right: 9, height: 2, background: "var(--accent)" }} />
          <div style={{ position: "absolute", left: 9, top: 13, width: 8, height: 2, background: "var(--accent)" }} />
        </div>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: "-0.01em", fontWeight: 500 }}>
          Upshot
        </span>
      </div>

      {/* Search hint */}
      <div style={{ padding: "2px 12px 12px 12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 10px",
            background: "var(--surface)",
            border: "1px solid var(--hairline)",
            borderRadius: 10,
            color: "var(--ink-3)",
            fontSize: 13,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="6.5" cy="6.5" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <span style={{ flex: 1 }}>Jump or ask…</span>
          <span
            style={{
              fontSize: 11,
              color: "var(--ink-4)",
              padding: "1px 5px",
              border: "1px solid var(--hairline)",
              borderRadius: 4,
            }}
          >
            ⌘K
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "4px 8px", display: "flex", flexDirection: "column", gap: 1 }}>
        {NAV.map(({ href, label, icon, countKey }) => {
          const isActive = pathname === href;
          const badge = countKey ? counts?.[countKey] : undefined;
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 10px",
                borderRadius: 8,
                color: isActive ? "var(--ink)" : "var(--ink-2)",
                background: isActive ? "var(--surface)" : "transparent",
                boxShadow: isActive ? "var(--shadow-1)" : "none",
                fontSize: 13.5,
                fontWeight: isActive ? 500 : 400,
                textDecoration: "none",
              }}
            >
              <span style={{ color: isActive ? "var(--accent)" : "var(--ink-3)" }}>
                <NavIcon type={icon} />
              </span>
              <span style={{ flex: 1 }}>{label}</span>
              {badge != null && badge > 0 && (
                <span style={{ fontSize: 11, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Areas */}
      <div
        style={{
          padding: "18px 18px 6px 18px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--ink-4)",
        }}
      >
        <span style={{ flex: 1 }}>Areas</span>
        <button
          onClick={() => setAddingArea(true)}
          title="New area"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 16,
            height: 16,
            borderRadius: 5,
            color: "var(--ink-4)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--ink-2)"; e.currentTarget.style.background = "var(--surface-2)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink-4)"; e.currentTarget.style.background = "transparent"; }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
      <div
        style={{
          padding: "0 8px",
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {addingArea && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "5px 10px",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: AREA_COLOR_PALETTE[areas.length % AREA_COLOR_PALETTE.length],
                flexShrink: 0,
              }}
            />
            <input
              ref={newAreaRef}
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); submitNewArea(); }
                if (e.key === "Escape") { setNewAreaName(""); setAddingArea(false); }
              }}
              onBlur={submitNewArea}
              placeholder="New area"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 13.5,
                color: "var(--ink)",
                fontFamily: "inherit",
                padding: 0,
              }}
            />
          </div>
        )}
        {areas.map((area) => {
              const areaProjects = topLevelProjects.filter((p) => p.areaId === area.id);
              const areaHref = `/v2/area/${area.id}`;
              const areaActive = pathname === areaHref;
              return (
                <div key={area.id}>
                  <Link
                    href={areaHref}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "5px 10px",
                      borderRadius: 8,
                      color: areaActive ? "var(--ink)" : "var(--ink-2)",
                      background: areaActive ? "var(--surface)" : "transparent",
                      boxShadow: areaActive ? "var(--shadow-1)" : "none",
                      fontSize: 13.5,
                      fontWeight: areaActive ? 500 : 400,
                      textDecoration: "none",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: area.color ?? "var(--ink-4)",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1 }}>{area.name}</span>
                    {areaProjects.length > 0 && (
                      <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{areaProjects.length}</span>
                    )}
                  </Link>
                  {areaProjects.map((p) => {
                    const isActive = pathname === `/v2/project/${p.id}`;
                    return (
                      <Link
                        key={p.id}
                        href={`/v2/project/${p.id}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "4px 10px 4px 28px",
                          borderRadius: 8,
                          color: isActive ? "var(--ink)" : "var(--ink-3)",
                          background: isActive ? "var(--surface)" : "transparent",
                          boxShadow: isActive ? "var(--shadow-1)" : "none",
                          fontWeight: isActive ? 500 : 400,
                          fontSize: 13,
                          textDecoration: "none",
                        }}
                      >
                        <span
                          style={{
                            width: 11,
                            height: 11,
                            borderRadius: 3,
                            flexShrink: 0,
                            border: `1.5px solid ${isActive ? "var(--accent)" : "var(--hairline-strong)"}`,
                          }}
                        />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.name}
                        </span>
                        {p.taskCount > 0 && (
                          <span style={{ fontSize: 11, color: "var(--ink-4)", fontVariantNumeric: "tabular-nums" }}>
                            {p.taskCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })}

      </div>

      {/* Orphan projects (no area) */}
      {topLevelProjects.some((p) => !p.areaId) && (
        <>
          <div
            style={{
              padding: "14px 18px 6px 18px",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--ink-4)",
            }}
          >
            Projects
          </div>
          <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 1 }}>
            {topLevelProjects
              .filter((p) => !p.areaId)
              .map((p) => {
                const isActive = pathname === `/v2/project/${p.id}`;
                return (
                  <Link
                    key={p.id}
                    href={`/v2/project/${p.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "4px 10px",
                      borderRadius: 8,
                      color: isActive ? "var(--ink)" : "var(--ink-3)",
                      background: isActive ? "var(--surface)" : "transparent",
                      boxShadow: isActive ? "var(--shadow-1)" : "none",
                      fontWeight: isActive ? 500 : 400,
                      fontSize: 13,
                      textDecoration: "none",
                    }}
                  >
                    <span
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: 3,
                        flexShrink: 0,
                        border: `1.5px solid ${p.color ?? (isActive ? "var(--accent)" : "var(--hairline-strong)")}`,
                        background: p.color ? `${p.color}33` : "transparent",
                      }}
                    />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </span>
                    {p.taskCount > 0 && (
                      <span style={{ fontSize: 11, color: "var(--ink-4)", fontVariantNumeric: "tabular-nums" }}>
                        {p.taskCount}
                      </span>
                    )}
                  </Link>
                );
              })}
          </div>
        </>
      )}

      {/* Footer: accent picker + theme toggle + settings */}
      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid var(--hairline)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {/* Accent swatches */}
        <div style={{ display: "flex", gap: 5, flex: 1 }}>
          {ACCENT_SWATCHES.map(({ id, color }) => (
            <button
              key={id}
              onClick={() => onAccentChange(id)}
              title={id}
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: color,
                border: accent === id ? "2px solid var(--ink)" : "2px solid transparent",
                boxShadow: "inset 0 0 0 1.5px var(--bg-sunken)",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
        {/* Theme toggle */}
        <button
          onClick={onThemeToggle}
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          style={{
            fontSize: 11,
            color: "var(--ink-4)",
            padding: "2px 6px",
            border: "1px solid var(--hairline)",
            borderRadius: 5,
            background: "transparent",
            cursor: "pointer",
          }}
        >
          {theme === "light" ? "Dark" : "Light"}
        </button>
      </div>
      <Link
        href="/settings/shortcuts"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          borderTop: "1px solid var(--hairline)",
          color: "var(--ink-3)",
          fontSize: 12,
          textDecoration: "none",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4.9 2-3.4-2-1.5A7 7 0 0 0 19 12z"/></svg>
        <span>Settings</span>
      </Link>
    </aside>
  );
}
