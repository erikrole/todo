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
import { Inbox, Sun, Calendar, BookOpen, CheckSquare, FolderOpen, Layers } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const { data: tasks = [] } = useTasks("all");
  const { data: projects = [] } = useProjects();
  const { data: areas = [] } = useAreas();

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
              {tasks.slice(0, 20).map((task) => (
                <CommandItem key={task.id} value={task.title} onSelect={() => setOpen(false)}>
                  <CheckSquare className="mr-2 h-4 w-4" />
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
