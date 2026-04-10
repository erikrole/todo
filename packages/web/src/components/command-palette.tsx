"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useTasks } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useAreas } from "@/hooks/use-areas";
import { Inbox, Sun, Calendar, BookOpen, CheckSquare, FolderOpen, Layers, Hourglass } from "lucide-react";
import type { Task } from "@todo/shared";

function taskDestination(task: Task): string {
  if (task.projectId) return `/project/${task.projectId}`;
  if (task.areaId) return `/area/${task.areaId}`;
  if (task.isSomeday) return "/someday";
  const today = new Date().toISOString().slice(0, 10);
  if (task.whenDate === today) return "/today";
  if (task.whenDate && task.whenDate > today) return "/upcoming";
  return "/inbox";
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const { data: tasks = [] } = useTasks("all", undefined, undefined, { enabled: open });
  const { data: projects = [] } = useProjects(undefined, { enabled: open });
  const { data: areas = [] } = useAreas({ enabled: open });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    router.push(href);
    setOpen(false);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search tasks, projects, views…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Views">
          {[
            { href: "/inbox", label: "Inbox", icon: Inbox },
            { href: "/today", label: "Today", icon: Sun },
            { href: "/upcoming", label: "Upcoming", icon: Calendar },
            { href: "/logbook", label: "Logbook", icon: BookOpen },
          ].map(({ href, label, icon: Icon }) => (
            <CommandItem key={href} onSelect={() => go(href)}>
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>

        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {projects.filter((p) => !p.isCompleted).map((project) => (
                <CommandItem key={project.id} onSelect={() => go(`/project/${project.id}`)}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {project.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {areas.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Areas">
              {areas.filter((a) => !a.isArchived).map((area) => (
                <CommandItem key={area.id} onSelect={() => go(`/area/${area.id}`)}>
                  <Layers className="mr-2 h-4 w-4" />
                  {area.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {tasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tasks">
              {tasks
                .filter((t) => !t.isCompleted)
                .slice(0, 20)
                .map((task) => (
                  <CommandItem
                    key={task.id}
                    value={task.title}
                    onSelect={() => go(taskDestination(task))}
                  >
                    {task.isSomeday ? (
                      <Hourglass className="mr-2 h-4 w-4 text-muted-foreground" />
                    ) : (
                      <CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" />
                    )}
                    {task.title}
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
