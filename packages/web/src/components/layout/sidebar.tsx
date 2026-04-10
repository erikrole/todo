"use client";

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
import { ThemeToggle } from "@/components/theme-toggle";
import { useAreas } from "@/hooks/use-areas";
import { useProjects } from "@/hooks/use-projects";
import { DroppableZone } from "@/components/dnd/droppable-zone";
import { cn } from "@/lib/utils";
import { Inbox, Sun, Calendar, Hourglass, BookOpen, ChevronRight, Trash2 } from "lucide-react";

const NAV_ITEMS = [
  { href: "/inbox", label: "Inbox", icon: Inbox, dropId: "sidebar:inbox" },
  { href: "/today", label: "Today", icon: Sun, dropId: "sidebar:today" },
  { href: "/upcoming", label: "Upcoming", icon: Calendar, dropId: "sidebar:upcoming" },
  { href: "/someday", label: "Someday", icon: Hourglass, dropId: "sidebar:someday" },
  { href: "/logbook", label: "Logbook", icon: BookOpen, dropId: null },
  { href: "/trash", label: "Trash", icon: Trash2, dropId: null },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: areas = [] } = useAreas();
  const { data: allProjects = [] } = useProjects();

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
                const areaProjects = allProjects.filter((p) => p.areaId === area.id && !p.isCompleted);
                return (
                  <Collapsible key={area.id} defaultOpen className="group/collapsible">
                    <SidebarMenuItem>
                      <DroppableZone id={`sidebar:area:${area.id}`} className="w-full">
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton isActive={pathname === `/area/${area.id}`} asChild={false}>
                            <Link href={`/area/${area.id}`} className="flex flex-1 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              {area.color && (
                                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: area.color }} />
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
                                  <SidebarMenuSubButton asChild isActive={pathname === `/project/${project.id}`}>
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

        {/* Standalone projects (no area) */}
        {allProjects.filter((p) => !p.areaId && !p.isCompleted).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Projects</SidebarGroupLabel>
            <SidebarMenu>
              {allProjects
                .filter((p) => !p.areaId && !p.isCompleted)
                .map((project) => (
                  <SidebarMenuItem key={project.id}>
                    <DroppableZone id={`sidebar:project:${project.id}`} className="w-full">
                      <SidebarMenuButton asChild isActive={pathname === `/project/${project.id}`}>
                        <Link href={`/project/${project.id}`}>
                          {project.color && (
                            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                          )}
                          <span className="truncate">{project.name}</span>
                          {project.taskCount > 0 && (
                            <span className="ml-auto text-xs text-muted-foreground">{project.taskCount}</span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </DroppableZone>
                  </SidebarMenuItem>
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
