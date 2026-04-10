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
import { useProjects, useCreateProject } from "@/hooks/use-projects";
import { DroppableZone } from "@/components/dnd/droppable-zone";
import { cn } from "@/lib/utils";
import { Inbox, Sun, Calendar, Hourglass, BookOpen, ChevronRight, Trash2 } from "lucide-react";
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
  const { isOpen, toggle } = useProjectCollapseState(project.id);
  const [addingSubProject, setAddingSubProject] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const hasChildren = subProjects.length > 0;
  const isActive = pathname === `/project/${project.id}`;
  const isParentActive = !isActive && subProjects.some((s) => pathname === `/project/${s.id}`);

  useEffect(() => {
    if (addingSubProject) setTimeout(() => inputRef.current?.focus(), 50);
  }, [addingSubProject]);

  async function submitSubProject() {
    const name = newSubName.trim();
    if (!name) {
      setAddingSubProject(false);
      return;
    }
    await createProject.mutateAsync({ name, parentProjectId: project.id });
    setNewSubName("");
    setAddingSubProject(false);
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
      </SidebarMenuSubItem>
    );
  }

  const projectLinkContent = (
    <DroppableZone id={`sidebar:project:${project.id}`} className="w-full">
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
            <ContextMenuItem onSelect={() => setAddingSubProject(true)}>
              Add Sub-project
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

  const topLevelProjects = allProjects.filter((p) => !p.parentProjectId && !p.isCompleted);
  const subProjectMap = new Map<string, ProjectWithCounts[]>();
  for (const p of allProjects) {
    if (p.parentProjectId) {
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
        {topLevelProjects.filter((p) => !p.areaId).length > 0 && (
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
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <ThemeToggle />
      </SidebarFooter>
    </Sidebar>
  );
}
