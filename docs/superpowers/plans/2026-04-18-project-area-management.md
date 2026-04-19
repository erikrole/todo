# Project & Area Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full project/area management to the v2 UI — sections with drag-to-reorder, sidebar collapse/context menus/color picker, delete/archive flows, move project between areas, and someday toggle on tasks.

**Architecture:** All features build on existing hooks (`useAreas`, `useProjects`, `useSections`, `useUpdateArea`, `useDeleteProject`, etc.) and the existing `section-block.tsx` component. No new API routes needed — every endpoint already exists. Work is UI-only except for adding `isCollapsed` localStorage state for sidebar areas.

**Tech Stack:** Next.js App Router, TanStack React Query, shadcn/ui (ContextMenu, AlertDialog, Popover, Dialog), @dnd-kit/sortable, Tailwind CSS, TypeScript strict

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `packages/web/src/app/(upshot)/v2/project/[id]/page.tsx` | Modify | Add sections rendering, drag-to-reorder |
| `packages/web/src/components/upshot/sidebar.tsx` | Modify | Collapse, context menus, color picker |
| `packages/web/src/components/upshot/area-context-menu.tsx` | Create | Area right-click options |
| `packages/web/src/components/upshot/project-context-menu.tsx` | Create | Project right-click options |
| `packages/web/src/components/upshot/color-picker-popover.tsx` | Create | Reusable oklch color swatch picker |
| `packages/web/src/components/upshot/delete-confirm-dialog.tsx` | Create | Reusable AlertDialog for destructive confirms |
| `packages/web/src/components/upshot/move-project-dialog.tsx` | Create | Dialog to reassign project to different area |
| `packages/web/src/hooks/use-sidebar-collapse.ts` | Create | localStorage collapse state per area |
| `packages/web/src/components/tasks/task-item.tsx` | Modify | Add Someday toggle to context menu |

---

## Task 1: Sections in v2 Project Page

Port the v1 section rendering to the v2 project page. The `section-block.tsx` component already handles rendering, inline rename, delete, and drag handles — this task is wiring it into the v2 page.

**Files:**
- Modify: `packages/web/src/app/(upshot)/v2/project/[id]/page.tsx`

Reference implementation at: `packages/web/src/app/(views)/project/[id]/page.tsx` (v1 — has full sections + DnD)

- [ ] **Step 1: Add `useSections` to the v2 project page**

In `packages/web/src/app/(upshot)/v2/project/[id]/page.tsx`, add the sections query alongside the existing `useTasks` call:

```tsx
const { data: sectionsData } = useSections(projectId);
const sections = sectionsData?.data ?? [];
```

Import `useSections` from `"@/hooks/use-sections"`.

- [ ] **Step 2: Group tasks by sectionId**

After the tasks query, add grouping logic:

```tsx
const tasks = tasksData?.data ?? [];

const unsectionedTasks = tasks.filter(
  (t) => !t.sectionId && !t.isCompleted
);

const tasksBySection = sections.reduce<Record<string, typeof tasks>>(
  (acc, section) => {
    acc[section.id] = tasks.filter(
      (t) => t.sectionId === section.id && !t.isCompleted
    );
    return acc;
  },
  {}
);
```

- [ ] **Step 3: Replace flat `<TaskList>` with sectioned rendering**

Replace the current single `<TaskList tasks={activeTasks} .../>` block with:

```tsx
<div className="space-y-6">
  {/* Unsectioned tasks */}
  {unsectionedTasks.length > 0 && (
    <TaskList
      tasks={unsectionedTasks}
      quickAddDefaults={{ projectId }}
      activeSections={sections}
    />
  )}

  {/* Sectioned tasks */}
  {sections.map((section) => (
    <SectionBlock
      key={section.id}
      section={section}
      tasks={tasksBySection[section.id] ?? []}
      quickAddDefaults={{ projectId, sectionId: section.id }}
      activeSections={sections}
    />
  ))}
</div>
```

Import `SectionBlock` from `"@/components/projects/section-block"`.

- [ ] **Step 4: Add "New Section" button below the task list**

Add after the sections map:

```tsx
<NewSectionInput projectId={projectId} />
```

Create `NewSectionInput` inline at top of file (or extract to component):

```tsx
function NewSectionInput({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const { mutate: createSection } = useCreateSection();

  const submit = () => {
    if (!title.trim()) return;
    createSection({ projectId, title: title.trim() });
    setTitle("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        <Plus className="h-3.5 w-3.5" />
        New Section
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") setOpen(false);
      }}
      onBlur={submit}
      placeholder="Section name"
      className="text-sm bg-transparent border-b border-border outline-none w-full py-1"
    />
  );
}
```

Import `useCreateSection` from `"@/hooks/use-sections"` and `Plus` from `"lucide-react"`.

- [ ] **Step 5: Add drag-to-reorder for sections**

Wrap the sections rendering in DnD context (mirror v1 pattern):

```tsx
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { useUpdateSection } from "@/hooks/use-sections";
import { useQueryClient } from "@tanstack/react-query";

// Inside component:
const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
const queryClient = useQueryClient();
const { mutate: updateSection } = useUpdateSection();

const handleSectionDragEnd = (event: any) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const oldIndex = sections.findIndex((s) => s.id === active.id);
  const newIndex = sections.findIndex((s) => s.id === over.id);
  const reordered = arrayMove(sections, oldIndex, newIndex);

  // Optimistic update
  queryClient.setQueryData(["sections", projectId], (old: any) => ({
    ...old,
    data: reordered,
  }));

  // Calculate new position (fractional indexing)
  const prev = reordered[newIndex - 1];
  const next = reordered[newIndex + 1];
  const newPosition =
    prev && next ? (prev.position + next.position) / 2
    : prev ? prev.position + 1
    : next ? next.position - 1
    : 0;

  updateSection({ id: active.id, position: newPosition });
};
```

Wrap sections rendering:

```tsx
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
  <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
    {sections.map((section) => (
      <SectionBlock key={section.id} ... />
    ))}
  </SortableContext>
</DndContext>
```

- [ ] **Step 6: Verify in browser**

Run `pnpm dev`, navigate to a project with sections (e.g., Lawn Care). Confirm:
- Three sections render with their tasks
- "New Section" button appears and creates sections
- Sections can be dragged to reorder
- Sections can be renamed and deleted via right-click

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/app/\(upshot\)/v2/project/\[id\]/page.tsx
git commit -m "feat(v2): sections rendering, create, reorder in project page"
```

---

## Task 2: Sidebar Area Collapse

Add per-area collapse state stored in localStorage. Collapsed areas show just the area link row; expanded areas show project links beneath.

**Files:**
- Create: `packages/web/src/hooks/use-sidebar-collapse.ts`
- Modify: `packages/web/src/components/upshot/sidebar.tsx`

- [ ] **Step 1: Create `use-sidebar-collapse.ts`**

```typescript
// packages/web/src/hooks/use-sidebar-collapse.ts
import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "sidebar-area-collapsed";

function loadCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function useSidebarCollapse() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCollapsed(loadCollapsed());
  }, []);

  const toggle = useCallback((areaId: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [areaId]: !prev[areaId] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isCollapsed = useCallback(
    (areaId: string) => collapsed[areaId] ?? false,
    [collapsed]
  );

  return { isCollapsed, toggle };
}
```

- [ ] **Step 2: Add collapse toggle to sidebar area rows**

In `sidebar.tsx`, import the hook and add a chevron button to each area row. Find where area links are rendered — it's a map over `areas`. Wrap with a fragment and add a collapse toggle:

```tsx
import { useSidebarCollapse } from "@/hooks/use-sidebar-collapse";
import { ChevronRight } from "lucide-react";

// Inside SidebarContent (or equivalent):
const { isCollapsed, toggle } = useSidebarCollapse();

// In the areas.map():
<div key={area.id}>
  <div className="flex items-center group">
    <button
      onClick={() => toggle(area.id)}
      className="flex-shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
      aria-label={isCollapsed(area.id) ? "Expand area" : "Collapse area"}
    >
      <ChevronRight
        className={cn(
          "h-3.5 w-3.5 transition-transform duration-150",
          !isCollapsed(area.id) && "rotate-90"
        )}
      />
    </button>
    <Link href={`/v2/area/${area.id}`} ...>
      {/* existing area link content */}
    </Link>
  </div>

  {/* Projects — only if not collapsed */}
  {!isCollapsed(area.id) && (
    <div>
      {/* existing project links */}
    </div>
  )}
</div>
```

- [ ] **Step 3: Verify**

Navigate to sidebar, click the chevron next to "Home Projects" (11 projects). Confirm projects fold/unfold. Refresh page — collapse state persists.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/hooks/use-sidebar-collapse.ts packages/web/src/components/upshot/sidebar.tsx
git commit -m "feat(sidebar): per-area collapse with localStorage persistence"
```

---

## Task 3: Area Color Picker

Add a color picker popover that updates the area's oklch color via the existing PATCH endpoint.

**Files:**
- Create: `packages/web/src/components/upshot/color-picker-popover.tsx`
- Modify: `packages/web/src/components/upshot/sidebar.tsx`

- [ ] **Step 1: Create `color-picker-popover.tsx`**

```tsx
// packages/web/src/components/upshot/color-picker-popover.tsx
"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const AREA_COLORS = [
  { label: "Ochre",  value: "oklch(0.68 0.13 58)" },
  { label: "Clay",   value: "oklch(0.63 0.13 30)" },
  { label: "Sage",   value: "oklch(0.62 0.08 150)" },
  { label: "Slate",  value: "oklch(0.58 0.08 240)" },
  { label: "Plum",   value: "oklch(0.56 0.12 320)" },
  { label: "Crimson",value: "oklch(0.58 0.18 20)" },
  { label: "Moss",   value: "oklch(0.55 0.10 130)" },
  { label: "Sky",    value: "oklch(0.65 0.10 220)" },
];

interface ColorPickerPopoverProps {
  currentColor: string | null;
  onSelect: (color: string) => void;
  children: React.ReactNode;
}

export function ColorPickerPopover({ currentColor, onSelect, children }: ColorPickerPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-48 p-3" align="start">
        <p className="text-xs text-muted-foreground mb-2">Area color</p>
        <div className="grid grid-cols-4 gap-2">
          {AREA_COLORS.map((color) => (
            <button
              key={color.value}
              title={color.label}
              onClick={() => onSelect(color.value)}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                currentColor === color.value
                  ? "border-foreground"
                  : "border-transparent"
              )}
              style={{ backgroundColor: color.value }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Wire into sidebar area context menu (preview)**

We'll use this in Task 4 (context menu). For now, verify the component renders by temporarily adding it to a single area row as a dot-click trigger:

```tsx
import { ColorPickerPopover } from "./color-picker-popover";
import { useUpdateArea } from "@/hooks/use-areas";

const { mutate: updateArea } = useUpdateArea();

// In area row, make the color dot clickable:
<ColorPickerPopover
  currentColor={area.color}
  onSelect={(color) => updateArea({ id: area.id, color })}
>
  <button
    className="h-2 w-2 rounded-full flex-shrink-0"
    style={{ backgroundColor: area.color ?? "oklch(0.58 0.08 240)" }}
  />
</ColorPickerPopover>
```

- [ ] **Step 3: Verify**

Click the color dot next to an area in the sidebar. Confirm the popover opens, selecting a color updates the dot immediately (optimistic or after refetch).

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/upshot/color-picker-popover.tsx packages/web/src/components/upshot/sidebar.tsx
git commit -m "feat(sidebar): area color picker popover"
```

---

## Task 4: Sidebar Context Menus (Areas + Projects)

Add right-click context menus to area and project rows in the sidebar. Areas get: rename, change color, archive, delete. Projects get: rename, move to area, archive, delete.

**Files:**
- Create: `packages/web/src/components/upshot/delete-confirm-dialog.tsx`
- Create: `packages/web/src/components/upshot/move-project-dialog.tsx`
- Modify: `packages/web/src/components/upshot/sidebar.tsx`

- [ ] **Step 1: Create `delete-confirm-dialog.tsx`**

```tsx
// packages/web/src/components/upshot/delete-confirm-dialog.tsx
"use client";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({
  open, onOpenChange, title, description, onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Create `move-project-dialog.tsx`**

```tsx
// packages/web/src/components/upshot/move-project-dialog.tsx
"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAreas } from "@/hooks/use-areas";
import { useUpdateProject } from "@/hooks/use-projects";

interface MoveProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  currentAreaId: string | null;
}

export function MoveProjectDialog({
  open, onOpenChange, projectId, projectName, currentAreaId,
}: MoveProjectDialogProps) {
  const { data: areasData } = useAreas();
  const areas = areasData?.data ?? [];
  const { mutate: updateProject } = useUpdateProject();
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(currentAreaId);

  const handleMove = () => {
    updateProject({ id: projectId, areaId: selectedAreaId ?? undefined });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Move "{projectName}"</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 py-2">
          <button
            onClick={() => setSelectedAreaId(null)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              selectedAreaId === null ? "bg-accent" : "hover:bg-accent/50"
            }`}
          >
            No area (orphan)
          </button>
          {areas.map((area) => (
            <button
              key={area.id}
              onClick={() => setSelectedAreaId(area.id)}
              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
                selectedAreaId === area.id ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: area.color ?? "oklch(0.58 0.08 240)" }}
              />
              {area.name}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleMove}>Move</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Add area context menu to sidebar**

In `sidebar.tsx`, wrap each area row with `ContextMenu` from shadcn. The area row needs local state for the delete dialog and inline rename:

```tsx
import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { useDeleteArea, useUpdateArea } from "@/hooks/use-areas";
import { useRouter } from "next/navigation";

// Per-area state (use a map keyed by area.id or co-locate with a sub-component):
// Easiest: extract AreaRow as a sub-component with its own local state.

function AreaRow({ area, projects, children }: {
  area: Area;
  projects: Project[];
  children: React.ReactNode; // the project links
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(area.name);
  const { mutate: deleteArea } = useDeleteArea();
  const { mutate: updateArea } = useUpdateArea();
  const { isCollapsed, toggle } = useSidebarCollapse();
  const router = useRouter();

  const commitRename = () => {
    if (draftName.trim() && draftName !== area.name) {
      updateArea({ id: area.id, name: draftName.trim() });
    }
    setRenaming(false);
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex items-center group">
            <button onClick={() => toggle(area.id)} ...>
              <ChevronRight className={cn(...)} />
            </button>
            {renaming ? (
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") { setDraftName(area.name); setRenaming(false); }
                }}
                className="flex-1 bg-transparent text-sm outline-none border-b border-border"
              />
            ) : (
              <Link href={`/v2/area/${area.id}`} ...>
                {/* existing area link content */}
              </Link>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => { setDraftName(area.name); setRenaming(true); }}>
            Rename
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Delete Area
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {!isCollapsed(area.id) && children}

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${area.name}"?`}
        description="Projects in this area will become orphaned (not deleted). This cannot be undone."
        onConfirm={() => {
          deleteArea(area.id);
          router.push("/v2/inbox");
        }}
      />
    </>
  );
}
```

Refactor the sidebar areas map to use `<AreaRow>` component.

- [ ] **Step 4: Add project context menu to sidebar**

Similarly, extract `ProjectRow` component with context menu:

```tsx
function ProjectRow({ project }: { project: Project }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(project.name);
  const { mutate: deleteProject } = useDeleteProject();
  const { mutate: updateProject } = useUpdateProject();
  const router = useRouter();

  const commitRename = () => {
    if (draftName.trim() && draftName !== project.name) {
      updateProject({ id: project.id, name: draftName.trim() });
    }
    setRenaming(false);
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            {renaming ? (
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") { setDraftName(project.name); setRenaming(false); }
                }}
                className="w-full bg-transparent text-sm outline-none border-b border-border px-7 py-1"
              />
            ) : (
              <Link href={`/v2/project/${project.id}`} ...>
                {/* existing project link + task count */}
              </Link>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => { setDraftName(project.name); setRenaming(true); }}>
            Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setMoveOpen(true)}>
            Move to Area…
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Delete Project
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <MoveProjectDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        projectId={project.id}
        projectName={project.name}
        currentAreaId={project.areaId ?? null}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${project.name}"?`}
        description="All tasks in this project will be permanently deleted. This cannot be undone."
        onConfirm={() => {
          deleteProject(project.id);
          router.push("/v2/inbox");
        }}
      />
    </>
  );
}
```

- [ ] **Step 5: Add color picker to area context menu**

Add a "Change Color…" entry that opens `ColorPickerPopover`. Since ContextMenu items can't nest Popover easily, use a sub-menu or a separate popover state. Cleanest approach — add a sub-menu:

```tsx
import { ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from "@/components/ui/context-menu";
import { AREA_COLORS } from "./color-picker-popover"; // export the array

// In AreaRow ContextMenuContent:
<ContextMenuSub>
  <ContextMenuSubTrigger>Change Color</ContextMenuSubTrigger>
  <ContextMenuSubContent className="p-2">
    <div className="grid grid-cols-4 gap-1.5">
      {AREA_COLORS.map((color) => (
        <button
          key={color.value}
          title={color.label}
          onClick={() => updateArea({ id: area.id, color: color.value })}
          className={cn(
            "h-6 w-6 rounded-full border-2 hover:scale-110 transition-transform",
            area.color === color.value ? "border-foreground" : "border-transparent"
          )}
          style={{ backgroundColor: color.value }}
        />
      ))}
    </div>
  </ContextMenuSubContent>
</ContextMenuSub>
```

Export `AREA_COLORS` from `color-picker-popover.tsx`.

- [ ] **Step 6: Verify all context menus**

Right-click an area: Rename (inline edit), Change Color (sub-menu swatches), Delete Area (confirmation dialog).
Right-click a project: Rename, Move to Area (dialog with area list), Delete Project (confirmation).

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/components/upshot/
git commit -m "feat(sidebar): right-click context menus for areas and projects"
```

---

## Task 5: Project Task Count Badges in Sidebar

The `useProjects()` hook already returns `taskCount` on each project (from the API's left join). Just display it.

**Files:**
- Modify: `packages/web/src/components/upshot/sidebar.tsx`

- [ ] **Step 1: Display task count in ProjectRow**

In the `ProjectRow` link content, add the count:

```tsx
<Link href={`/v2/project/${project.id}`} className="flex items-center justify-between ...">
  <span className="truncate">{project.name}</span>
  {(project.taskCount ?? 0) > 0 && (
    <span className="text-xs text-muted-foreground tabular-nums ml-1 flex-shrink-0">
      {project.taskCount}
    </span>
  )}
</Link>
```

`taskCount` is already on the `Project` type from `ProjectWithCounts`. If `useProjects()` returns `ProjectWithCounts[]`, it's already there — confirm by checking `packages/shared/src/types.ts` for `ProjectWithCounts`.

- [ ] **Step 2: Verify**

Sidebar should show task counts to the right of project names. Projects with 0 tasks show nothing.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/upshot/sidebar.tsx
git commit -m "feat(sidebar): task count badges on project links"
```

---

## Task 6: Archive Project

Add "Archive" to the project context menu. Uses the existing `isCompleted` field — archiving = completing the project (removes it from active sidebar, moves to logbook).

**Files:**
- Modify: `packages/web/src/components/upshot/sidebar.tsx` (ProjectRow)

The `useCompleteProject()` hook already exists and calls `/api/projects/[id]/complete`.

- [ ] **Step 1: Add Archive to ProjectRow context menu**

```tsx
import { useCompleteProject } from "@/hooks/use-projects";

// In ProjectRow:
const { mutate: completeProject } = useCompleteProject();

// In ContextMenuContent, before Delete separator:
<ContextMenuItem onClick={() => {
  completeProject(project.id);
  router.push("/v2/inbox");
}}>
  Archive Project
</ContextMenuItem>
<ContextMenuSeparator />
```

- [ ] **Step 2: Verify**

Right-click a project → Archive Project → project disappears from sidebar, page redirects to inbox.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/upshot/sidebar.tsx
git commit -m "feat(sidebar): archive project from context menu"
```

---

## Task 7: Someday Toggle on Tasks

The `isSomeday` field exists on the task schema. Add a toggle in the task context menu (right-click on task item). When enabled, the task appears in the Someday view and is hidden from Today/Upcoming.

**Files:**
- Modify: `packages/web/src/components/tasks/task-item.tsx`

- [ ] **Step 1: Find the task context menu in `task-item.tsx`**

Search for `ContextMenu` or the right-click/options menu in task-item.tsx. The exploration shows it has "move (today/inbox/someday/next-week)" shortcuts — check if "someday" is already a context menu item or only a keyboard shortcut.

- [ ] **Step 2: Add Someday toggle to context menu**

In the task item's context menu items, add:

```tsx
import { useUpdateTask } from "@/hooks/use-tasks";

// In context menu:
<ContextMenuItem
  onClick={() => updateTask({ id: task.id, isSomeday: !task.isSomeday, whenDate: null })}
>
  {task.isSomeday ? "Move out of Someday" : "Move to Someday"}
</ContextMenuItem>
```

When moving to Someday, clear `whenDate` (task shouldn't appear in Today/Upcoming). When moving out, leave `whenDate` null — task goes to Inbox.

- [ ] **Step 3: Add visual indicator on task when isSomeday**

In the task item badges area, add a subtle "Someday" chip when `task.isSomeday`:

```tsx
{task.isSomeday && (
  <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">
    Someday
  </span>
)}
```

- [ ] **Step 4: Verify**

Open a task context menu → "Move to Someday". Task shows "Someday" badge. Navigate to Someday view — task appears there. Right-click again → "Move out of Someday" — badge disappears, task moves to Inbox.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/tasks/task-item.tsx
git commit -m "feat(tasks): someday toggle in context menu with badge"
```

---

## Task 8: Task Notes Rendering

The notes field on tasks is already stored and editable inline (textarea when expanded), but the imported notes contain multi-paragraph rich text. Add basic markdown-like rendering for notes in read mode.

**Files:**
- Modify: `packages/web/src/components/tasks/task-item.tsx`

- [ ] **Step 1: Add note preview in collapsed state**

When a task has notes and is not expanded, show a preview below the title:

```tsx
{task.notes && !isExpanded && (
  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
    {task.notes.split('\n')[0]}
  </p>
)}
```

This shows the first line of the notes as a preview without introducing a markdown dependency.

- [ ] **Step 2: Preserve line breaks in expanded notes view**

In the expanded notes textarea, confirm `whitespace-pre-wrap` is applied. If the textarea is replaced by a `<div>` for read mode, add:

```tsx
<div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
  {task.notes}
</div>
```

If notes is always in a `<textarea>`, no change needed — the textarea preserves line breaks natively.

- [ ] **Step 3: Verify**

Open Lawn Care project. "Core aeration — Badger Lawn Professionals" has a multi-line note. In collapsed state it shows the first line preview. Expanding shows full note with line breaks intact.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/tasks/task-item.tsx
git commit -m "feat(tasks): notes preview in collapsed state, preserve line breaks"
```

---

## Self-Review

**Spec coverage check:**

| Feature | Task |
|---|---|
| Sections in projects | Task 1 |
| Sorting within projects (drag sections + tasks via existing SectionBlock) | Task 1 |
| Delete projects | Task 4 (ProjectRow) |
| Delete areas | Task 4 (AreaRow) |
| Collapse area projects in sidebar | Task 2 |
| Change color of areas | Task 3 + Task 4 |
| Rename sections (context menu already in SectionBlock) | Task 1 (SectionBlock inherited) |
| Rename areas | Task 4 (AreaRow) |
| Rename projects | Task 4 (ProjectRow) |
| Reorder sections (drag) | Task 1 |
| Move task between projects | Exists in task-item.tsx context menu — verify during Task 7 |
| Move project between areas | Task 4 (MoveProjectDialog) |
| Task count badges | Task 5 |
| Archive project | Task 6 |
| Someday toggle | Task 7 |
| Notes rendering | Task 8 |

**Gaps identified:** None. All spec items covered.

**Placeholder scan:** No TBD, TODO, or "similar to" references found.

**Type consistency:**
- `useUpdateArea({ id, color, name })` — matches `UpdateAreaSchema`
- `useUpdateProject({ id, areaId, name })` — matches `UpdateProjectSchema`
- `useDeleteArea(id)` / `useDeleteProject(id)` — confirm hook signatures take string id
- `useCompleteProject(id)` — confirm takes string id
- `project.taskCount` — on `ProjectWithCounts`, returned by `useProjects()`
- `task.isSomeday` — on `Task` type from shared types

**Verify hook call signatures** by reading `packages/web/src/hooks/use-areas.ts` and `use-projects.ts` before implementing — the `mutate` call signatures may differ (some take `{id, ...data}`, some take two args).
