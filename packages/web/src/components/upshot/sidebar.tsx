"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useAreas, useCreateArea, useUpdateArea, useDeleteArea } from "@/hooks/use-areas";
import {
  useProjects,
  useUpdateProject,
  useDeleteProject,
  useCompleteProject,
} from "@/hooks/use-projects";
import { useSidebarCollapse } from "@/hooks/use-sidebar-collapse";
import { useTaskCounts } from "@/hooks/use-tasks";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { MoveProjectDialog } from "./move-project-dialog";
import type { AreaWithCounts, ProjectWithCounts } from "@todo/shared";
import type { Accent, Theme, FontPairing } from "./shell";

const COLOR_OPTIONS: { label: string; value: string }[] = [
  { label: "Ochre", value: "oklch(0.68 0.13 58)" },
  { label: "Clay", value: "oklch(0.63 0.13 30)" },
  { label: "Sage", value: "oklch(0.62 0.08 150)" },
  { label: "Slate", value: "oklch(0.58 0.08 240)" },
  { label: "Plum", value: "oklch(0.56 0.12 320)" },
  { label: "Crimson", value: "oklch(0.58 0.18 20)" },
  { label: "Moss", value: "oklch(0.55 0.10 130)" },
  { label: "Sky", value: "oklch(0.65 0.10 220)" },
];

const AREA_COLOR_PALETTE = COLOR_OPTIONS.slice(0, 5).map((o) => o.value);

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
  if (type === "logs") return <svg {...props}><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-6"/></svg>;
  if (type === "subscriptions") return <svg {...props}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>;
  if (type === "occasions") return <svg {...props}><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>;
  if (type === "logbook") return <svg {...props}><path d="M4 5h16M4 10h16M4 15h10M4 20h6"/></svg>;
  if (type === "trash") return <svg {...props}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>;
  if (type === "import") return <svg {...props}><path d="M12 3v12M8 11l4 4 4-4"/><path d="M4 19h16"/></svg>;
  return null;
}

type NavItem = { href: string; label: string; icon: string; countKey?: "inbox" | "today" | "overdue" };

const TASKS_NAV: NavItem[] = [
  { href: "/v2/today",    label: "Today",    icon: "today",    countKey: "today" },
  { href: "/v2/inbox",    label: "Inbox",    icon: "inbox",    countKey: "inbox" },
  { href: "/v2/upcoming", label: "Upcoming", icon: "upcoming" },
  { href: "/v2/someday",  label: "Someday",  icon: "someday" },
  { href: "/v2/routines", label: "Routines", icon: "routines" },
];

const LIFE_NAV: NavItem[] = [
  { href: "/v2/logs",          label: "Logs",          icon: "logs" },
  { href: "/v2/subscriptions", label: "Subscriptions", icon: "subscriptions" },
  { href: "/v2/occasions",     label: "Occasions",     icon: "occasions" },
];

const MORE_NAV: NavItem[] = [
  { href: "/v2/logbook", label: "Logbook", icon: "logbook" },
  { href: "/v2/trash",   label: "Trash",   icon: "trash" },
  { href: "/v2/import",  label: "Import",  icon: "import" },
];

function NavLink({ href, label, icon, isActive, badge }: { href: string; label: string; icon: string; isActive: boolean; badge?: number }) {
  return (
    <Link
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
        <span style={{ fontSize: 11, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{badge}</span>
      )}
    </Link>
  );
}

function NavSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: "10px 10px 4px 10px",
      fontSize: 10.5,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--ink-4)",
      fontWeight: 600,
    }}>
      {children}
    </div>
  );
}

interface SidebarProps {
  accent: Accent;
  onAccentChange: (a: Accent) => void;
  theme: Theme;
  onThemeToggle: () => void;
  font: FontPairing;
  onFontChange: (f: FontPairing) => void;
}

export function UpshootSidebar({ accent, onAccentChange, theme, onThemeToggle, font, onFontChange }: SidebarProps) {
  const pathname = usePathname();
  const { data: areas = [] } = useAreas();
  const { data: allProjects = [] } = useProjects();
  const { data: counts } = useTaskCounts();
  const createArea = useCreateArea();
  const { isCollapsed, toggle } = useSidebarCollapse();

  const [moreOpen, setMoreOpen] = useState(false);
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
        {TASKS_NAV.map(({ href, label, icon, countKey }) => {
          const isActive = pathname === href;
          const badge = countKey ? counts?.[countKey] : undefined;
          return (
            <NavLink key={href} href={href} label={label} icon={icon} isActive={isActive} badge={badge} />
          );
        })}

        <NavSectionLabel>Life</NavSectionLabel>

        {LIFE_NAV.map(({ href, label, icon }) => {
          const isActive = pathname === href;
          return <NavLink key={href} href={href} label={label} icon={icon} isActive={isActive} />;
        })}

        {/* More disclosure */}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 10px",
            borderRadius: 8,
            color: "var(--ink-4)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 13.5,
            fontFamily: "inherit",
            width: "100%",
            textAlign: "left",
          }}
        >
          <span style={{ color: "var(--ink-4)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            </svg>
          </span>
          <span style={{ flex: 1 }}>More</span>
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: moreOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
          >
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>

        {moreOpen && MORE_NAV.map(({ href, label, icon }) => {
          const isActive = pathname === href;
          return <NavLink key={href} href={href} label={label} icon={icon} isActive={isActive} />;
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
          return (
            <AreaRow
              key={area.id}
              area={area}
              projects={areaProjects}
              pathname={pathname}
              collapsed={isCollapsed(area.id)}
              onToggleCollapse={() => toggle(area.id)}
            />
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
              .map((p) => (
                <ProjectRow key={p.id} project={p} pathname={pathname} orphan />
              ))}
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
      {/* Font pairing picker */}
      <div style={{ display: "flex", gap: 4, padding: "0 8px 4px" }}>
        {(["editorial", "warm", "precise"] as FontPairing[]).map((f) => (
          <button
            key={f}
            onClick={() => onFontChange(f)}
            style={{
              flex: 1,
              fontSize: 10,
              padding: "3px 0",
              borderRadius: 5,
              textTransform: "capitalize",
              background: font === f ? "var(--accent-soft)" : "transparent",
              color: font === f ? "var(--accent-ink)" : "var(--ink-4)",
              border: font === f ? "1px solid color-mix(in oklch, var(--accent) 30%, transparent)" : "1px solid transparent",
              cursor: "pointer",
            }}
          >
            {f}
          </button>
        ))}
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

function AreaRow({
  area,
  projects,
  pathname,
  collapsed,
  onToggleCollapse,
}: {
  area: AreaWithCounts;
  projects: ProjectWithCounts[];
  pathname: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const router = useRouter();
  const updateArea = useUpdateArea();
  const deleteArea = useDeleteArea();

  const areaHref = `/v2/area/${area.id}`;
  const areaActive = pathname === areaHref;
  const hasProjects = projects.length > 0;

  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(area.name);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (renaming) {
      setDraftName(area.name);
      submittedRef.current = false;
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 20);
    }
  }, [renaming, area.name]);

  function commitRename() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const next = draftName.trim();
    if (next && next !== area.name) {
      updateArea.mutate({ id: area.id, name: next });
    }
    setRenaming(false);
  }

  function cancelRename() {
    submittedRef.current = true;
    setDraftName(area.name);
    setRenaming(false);
  }

  function handleDelete() {
    const wasActive = areaActive;
    deleteArea.mutate(area.id);
    setDeleteOpen(false);
    if (wasActive) router.push("/v2/inbox");
  }

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              borderRadius: 8,
              background: areaActive ? "var(--surface)" : "transparent",
              boxShadow: areaActive ? "var(--shadow-1)" : "none",
            }}
          >
            {hasProjects ? (
              <button
                onClick={onToggleCollapse}
                title={collapsed ? "Expand" : "Collapse"}
                aria-label={collapsed ? "Expand area" : "Collapse area"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 16,
                  height: 22,
                  marginLeft: 2,
                  color: "var(--ink-4)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--ink-2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink-4)"; }}
              >
                <ChevronRight
                  size={11}
                  strokeWidth={2.4}
                  style={{
                    transform: collapsed ? "none" : "rotate(90deg)",
                    transition: "transform 150ms ease",
                  }}
                />
              </button>
            ) : (
              <span style={{ display: "inline-block", width: 18, flexShrink: 0 }} />
            )}
            {renaming ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "5px 10px 5px 4px",
                  flex: 1,
                  minWidth: 0,
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
                <input
                  ref={inputRef}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                    if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                  }}
                  onBlur={commitRename}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: 13.5,
                    color: "var(--ink)",
                    fontFamily: "inherit",
                    fontWeight: areaActive ? 500 : 400,
                    padding: 0,
                    minWidth: 0,
                  }}
                />
              </div>
            ) : (
              <Link
                href={areaHref}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "5px 10px 5px 4px",
                  borderRadius: 8,
                  color: areaActive ? "var(--ink)" : "var(--ink-2)",
                  fontSize: 13.5,
                  fontWeight: areaActive ? 500 : 400,
                  textDecoration: "none",
                  flex: 1,
                  minWidth: 0,
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
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {area.name}
                </span>
                {hasProjects && (
                  <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{projects.length}</span>
                )}
              </Link>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={() => setRenaming(true)}>Rename</ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Change Color</ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-44">
              {COLOR_OPTIONS.map((opt) => (
                <ContextMenuItem
                  key={opt.value}
                  onSelect={() => updateArea.mutate({ id: area.id, color: opt.value })}
                  className="flex items-center gap-2"
                >
                  <span
                    className="h-3 w-3 rounded-sm flex-shrink-0"
                    style={{ background: opt.value, boxShadow: area.color === opt.value ? "0 0 0 1.5px var(--ink)" : "none" }}
                  />
                  <span className="flex-1">{opt.label}</span>
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            Delete Area
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {!collapsed && projects.map((p) => (
        <ProjectRow key={p.id} project={p} pathname={pathname} />
      ))}
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${area.name}"?`}
        description="Projects in this area will become orphaned (not deleted). This cannot be undone."
        onConfirm={handleDelete}
      />
    </div>
  );
}

function ProjectRow({
  project,
  pathname,
  orphan = false,
}: {
  project: ProjectWithCounts;
  pathname: string | null;
  orphan?: boolean;
}) {
  const router = useRouter();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const completeProject = useCompleteProject();

  const href = `/v2/project/${project.id}`;
  const isActive = pathname === href;

  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(project.name);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (renaming) {
      setDraftName(project.name);
      submittedRef.current = false;
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 20);
    }
  }, [renaming, project.name]);

  function commitRename() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const next = draftName.trim();
    if (next && next !== project.name) {
      updateProject.mutate({ id: project.id, name: next });
    }
    setRenaming(false);
  }

  function cancelRename() {
    submittedRef.current = true;
    setDraftName(project.name);
    setRenaming(false);
  }

  function handleArchive() {
    const wasActive = isActive;
    completeProject.mutate({ id: project.id });
    if (wasActive) router.push("/v2/inbox");
  }

  function handleDelete() {
    const wasActive = isActive;
    deleteProject.mutate(project.id);
    setDeleteOpen(false);
    if (wasActive) router.push("/v2/inbox");
  }

  const padLeft = orphan ? 10 : 28;
  const swatchBorder = orphan
    ? `1.5px solid ${project.color ?? (isActive ? "var(--accent)" : "var(--hairline-strong)")}`
    : `1.5px solid ${isActive ? "var(--accent)" : "var(--hairline-strong)"}`;
  const swatchBg = orphan && project.color ? `${project.color}33` : "transparent";

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {renaming ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: `4px 10px 4px ${padLeft}px`,
                borderRadius: 8,
                background: isActive ? "var(--surface)" : "transparent",
                boxShadow: isActive ? "var(--shadow-1)" : "none",
              }}
            >
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 3,
                  flexShrink: 0,
                  border: swatchBorder,
                  background: swatchBg,
                }}
              />
              <input
                ref={inputRef}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                  if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                }}
                onBlur={commitRename}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: 13,
                  fontWeight: isActive ? 500 : 400,
                  color: "var(--ink)",
                  fontFamily: "inherit",
                  padding: 0,
                  minWidth: 0,
                }}
              />
            </div>
          ) : (
            <Link
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: `4px 10px 4px ${padLeft}px`,
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
                  border: swatchBorder,
                  background: swatchBg,
                }}
              />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {project.name}
              </span>
              {project.taskCount > 0 && (
                <span style={{ fontSize: 11, color: "var(--ink-4)", fontVariantNumeric: "tabular-nums" }}>
                  {project.taskCount}
                </span>
              )}
            </Link>
          )}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={() => setRenaming(true)}>Rename</ContextMenuItem>
          <ContextMenuItem onSelect={() => setMoveOpen(true)}>Move to Area…</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={handleArchive}>Archive Project</ContextMenuItem>
          <ContextMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            Delete Project
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <MoveProjectDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        projectId={project.id}
        projectName={project.name}
        currentAreaId={project.areaId}
      />
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${project.name}"?`}
        description="All tasks in this project will be permanently deleted. This cannot be undone."
        onConfirm={handleDelete}
      />
    </>
  );
}
