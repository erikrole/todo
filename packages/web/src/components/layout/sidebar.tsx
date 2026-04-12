"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAreas } from "@/hooks/use-areas";
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from "@/hooks/use-projects";
import { DroppableZone } from "@/components/dnd/droppable-zone";
import { cn } from "@/lib/utils";
import { Inbox, Sun, Calendar, Hourglass, BookOpen, ChevronRight, Trash2, Plus } from "lucide-react";
import type { ProjectWithCounts } from "@todo/shared";

const NAV_ITEMS = [
  { href: "/inbox", label: "Inbox", icon: Inbox, dropId: "sidebar:inbox" },
  { href: "/today", label: "Today", icon: Sun, dropId: "sidebar:today" },
  { href: "/upcoming", label: "Upcoming", icon: Calendar, dropId: "sidebar:upcoming" },
  { href: "/someday", label: "Someday", icon: Hourglass, dropId: "sidebar:someday" },
  { href: "/logbook", label: "Logbook", icon: BookOpen, dropId: null },
  { href: "/trash", label: "Trash", icon: Trash2, dropId: null },
];

function useProjectCollapseState(projectId: string) {
  const key = `project-collapsed:${projectId}`;
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(key);
    return stored === null ? true : stored !== "false";
  });

  function toggle(open: boolean) {
    setIsOpen(open);
    localStorage.setItem(key, String(open));
  }

  return { isOpen, toggle };
}

interface ProjectItemProps {
  project: ProjectWithCounts;
  subProjects: ProjectWithCounts[];
  pathname: string;
  isSubProject?: boolean;
}

function ProjectItem({ project, subProjects, pathname, isSubProject = false }: ProjectItemProps) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const { isOpen, toggle } = useProjectCollapseState(project.id);
  const [addingSubProject, setAddingSubProject] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const renameSubmittedRef = useRef(false);
  const hasChildren = subProjects.length > 0;
  const isActive = pathname === `/project/${project.id}`;
  const isParentActive = !isActive && subProjects.some((s) => pathname === `/project/${s.id}`);

  useEffect(() => {
    if (addingSubProject) setTimeout(() => inputRef.current?.focus(), 50);
  }, [addingSubProject]);

  useEffect(() => {
    if (renaming) { setRenameValue(project.name); setTimeout(() => renameRef.current?.focus(), 50); }
  }, [renaming, project.name]);

  async function submitRename() {
    if (renameSubmittedRef.current) return;
    const name = renameValue.trim();
    if (!name || name === project.name) { setRenaming(false); return; }
    renameSubmittedRef.current = true;
    setRenaming(false);
    await updateProject.mutateAsync({ id: project.id, name });
    renameSubmittedRef.current = false;
  }

  async function submitSubProject() {
    const name = newSubName.trim();
    if (!name) {
      setAddingSubProject(false);
      return;
    }
    setNewSubName("");
    setAddingSubProject(false);
    await createProject.mutateAsync({ name, parentProjectId: project.id });
    toggle(true);
  }

  function handleSubProjectKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      submitSubProject();
    }
    if (e.key === "Escape") {
      setNewSubName("");
      setAddingSubProject(false);
    }
  }

  if (isSubProject) {
    return (
      <SidebarMenuSubItem>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            {renaming ? (
              <div className="flex items-center gap-2 px-2 py-1">
                <input
                  ref={renameRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); submitRename(); }
                    if (e.key === "Escape") { setRenaming(false); }
                  }}
                  onBlur={submitRename}
                  className="flex-1 bg-transparent text-xs outline-none border-b border-border pb-0.5"
                />
              </div>
            ) : (
              <SidebarMenuSubButton asChild isActive={isActive}>
                <Link href={`/project/${project.id}`}>
                  {project.color && (
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                  )}
                  <span className="truncate">{project.name}</span>
                  {project.taskCount > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground">{project.taskCount}</span>
                  )}
                </Link>
              </SidebarMenuSubButton>
            )}
          </ContextMenuTrigger>
          <ContextMenuContent className="w-44">
            <ContextMenuItem onSelect={() => setRenaming(true)}>Rename</ContextMenuItem>
            <ContextMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => deleteProject.mutate(project.id)}
            >
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </SidebarMenuSubItem>
    );
  }

  const projectLinkContent = (
    <DroppableZone id={`sidebar:project:${project.id}`} className="w-full">
      {renaming ? (
        <div className="flex items-center gap-2 px-2 py-1.5">
          <input
            ref={renameRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); submitRename(); }
              if (e.key === "Escape") { setRenaming(false); }
            }}
            onBlur={submitRename}
            className="flex-1 bg-transparent text-xs outline-none border-b border-border pb-0.5"
          />
        </div>
      ) : (
        <SidebarMenuButton
          asChild={false}
          isActive={isActive || isParentActive}
          className={cn(isParentActive && !isActive && "opacity-60")}
        >
          <Link
            href={`/project/${project.id}`}
            className="flex flex-1 items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {project.color && (
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
            )}
            <span className="flex-1 truncate">{project.name}</span>
            {project.taskCount > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">{project.taskCount}</span>
            )}
          </Link>
          {hasChildren && (
            <ChevronRight
              className={cn(
                "ml-1 h-3 w-3 transition-transform shrink-0",
                isOpen && "rotate-90",
              )}
              onClick={(e) => {
                e.stopPropagation();
                toggle(!isOpen);
              }}
            />
          )}
        </SidebarMenuButton>
      )}
    </DroppableZone>
  );

  return (
    <Collapsible open={isOpen} onOpenChange={toggle} className="group/collapsible">
      <SidebarMenuItem>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            {hasChildren ? (
              <CollapsibleTrigger asChild>{projectLinkContent}</CollapsibleTrigger>
            ) : (
              projectLinkContent
            )}
          </ContextMenuTrigger>
          <ContextMenuContent className="w-44">
            <ContextMenuItem onSelect={() => setAddingSubProject(true)}>Add Sub-project</ContextMenuItem>
            <ContextMenuItem onSelect={() => setRenaming(true)}>Rename</ContextMenuItem>
            <ContextMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => deleteProject.mutate(project.id)}
            >
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {(hasChildren || addingSubProject) && (
          <CollapsibleContent>
            <SidebarMenuSub>
              {subProjects.map((sub) => (
                <ProjectItem
                  key={sub.id}
                  project={sub}
                  subProjects={[]}
                  pathname={pathname}
                  isSubProject
                />
              ))}
              {addingSubProject && (
                <SidebarMenuSubItem>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <input
                      ref={inputRef}
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      onKeyDown={handleSubProjectKeyDown}
                      onBlur={submitSubProject}
                      placeholder="Sub-project name"
                      className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/40 border-b border-border pb-0.5"
                    />
                  </div>
                </SidebarMenuSubItem>
              )}
            </SidebarMenuSub>
          </CollapsibleContent>
        )}
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { data: areas = [] } = useAreas();
  const { data: allProjects = [] } = useProjects();
  const createProject = useCreateProject();
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const newProjectRef = useRef<HTMLInputElement>(null);
  const newProjectSubmittedRef = useRef(false);

  useEffect(() => {
    if (addingProject) setTimeout(() => newProjectRef.current?.focus(), 50);
  }, [addingProject]);

  async function submitNewProject() {
    if (newProjectSubmittedRef.current) return;
    const name = newProjectName.trim();
    if (!name) { setAddingProject(false); return; }
    newProjectSubmittedRef.current = true;
    setNewProjectName("");
    setAddingProject(false);
    await createProject.mutateAsync({ name });
    newProjectSubmittedRef.current = false;
  }

  const topLevelProjects = allProjects.filter((p) => !p.parentProjectId && !p.isCompleted);
  const subProjectMap = new Map<string, ProjectWithCounts[]>();
  for (const p of allProjects) {
    if (p.parentProjectId && !p.isCompleted) {
      const children = subProjectMap.get(p.parentProjectId) ?? [];
      children.push(p);
      subProjectMap.set(p.parentProjectId, children);
    }
  }

  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-5 pb-3">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
          <span className="text-sm font-semibold tracking-tight text-foreground/80">Todo</span>
        </span>
      </SidebarHeader>

      <SidebarContent>
        {/* Main nav */}
        <SidebarGroup>
          <SidebarMenu>
            {NAV_ITEMS.map(({ href, label, icon: Icon, dropId }) => (
              <SidebarMenuItem key={href}>
                {dropId ? (
                  <DroppableZone id={dropId} className="w-full">
                    <SidebarMenuButton asChild isActive={pathname === href}>
                      <Link href={href}>
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </DroppableZone>
                ) : (
                  <SidebarMenuButton asChild isActive={pathname === href}>
                    <Link href={href}>
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* Areas + Projects tree */}
        {areas.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Areas</SidebarGroupLabel>
            <SidebarMenu>
              {areas.map((area) => {
                const areaProjects = allProjects.filter(
                  (p) => p.areaId === area.id && !p.isCompleted && !p.parentProjectId,
                );
                return (
                  <Collapsible key={area.id} defaultOpen className="group/collapsible">
                    <SidebarMenuItem>
                      <DroppableZone id={`sidebar:area:${area.id}`} className="w-full">
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton isActive={pathname === `/area/${area.id}`} asChild={false}>
                            <Link
                              href={`/area/${area.id}`}
                              className="flex flex-1 items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {area.color && (
                                <span
                                  className="h-2 w-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: area.color }}
                                />
                              )}
                              <span className="flex-1 truncate">{area.name}</span>
                            </Link>
                            <ChevronRight className="ml-auto h-3 w-3 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                      </DroppableZone>
                      {areaProjects.length > 0 && (
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {areaProjects.map((project) => (
                              <SidebarMenuSubItem key={project.id}>
                                <DroppableZone id={`sidebar:project:${project.id}`} className="w-full">
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={pathname === `/project/${project.id}`}
                                  >
                                    <Link href={`/project/${project.id}`}>
                                      {project.color && (
                                        <span
                                          className="h-2 w-2 rounded-full flex-shrink-0"
                                          style={{ backgroundColor: project.color }}
                                        />
                                      )}
                                      <span className="truncate">{project.name}</span>
                                      {project.taskCount > 0 && (
                                        <span className="ml-auto text-xs text-muted-foreground">
                                          {project.taskCount}
                                        </span>
                                      )}
                                    </Link>
                                  </SidebarMenuSubButton>
                                </DroppableZone>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      )}
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* Standalone projects (no area, no parent) */}
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarMenu>
            {topLevelProjects
              .filter((p) => !p.areaId)
              .map((project) => (
                <ProjectItem
                  key={project.id}
                  project={project}
                  subProjects={subProjectMap.get(project.id) ?? []}
                  pathname={pathname}
                />
              ))}
            {addingProject && (
              <SidebarMenuItem>
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <input
                    ref={newProjectRef}
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); submitNewProject(); }
                      if (e.key === "Escape") { setNewProjectName(""); setAddingProject(false); }
                    }}
                    onBlur={submitNewProject}
                    placeholder="Project name"
                    className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/40 border-b border-border pb-0.5"
                  />
                </div>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild={false}
                className="text-muted-foreground/40 hover:text-primary/60 hover:bg-transparent font-normal"
                onClick={() => setAddingProject(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Project</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <ThemeToggle />
      </SidebarFooter>
    </Sidebar>
  );
}
