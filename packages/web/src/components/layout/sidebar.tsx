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
import { cn } from "@/lib/utils";
import { CheckSquare, Inbox, Sun, Calendar, BookOpen, ChevronRight } from "lucide-react";

const NAV_ITEMS = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/today", label: "Today", icon: Sun },
  { href: "/upcoming", label: "Upcoming", icon: Calendar },
  { href: "/logbook", label: "Logbook", icon: BookOpen },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: areas = [] } = useAreas();
  const { data: allProjects = [] } = useProjects();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Todo</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main nav */}
        <SidebarGroup>
          <SidebarMenu>
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton asChild isActive={pathname === href}>
                  <Link href={href}>
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </Link>
                </SidebarMenuButton>
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
                      {areaProjects.length > 0 && (
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {areaProjects.map((project) => (
                              <SidebarMenuSubItem key={project.id}>
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
