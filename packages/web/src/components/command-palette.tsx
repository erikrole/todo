"use client";

import { useState } from "react";
import { useShortcutAction } from "@/components/keyboard/keyboard-provider";
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
import { useTasks, useCreateTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useAreas } from "@/hooks/use-areas";
import { parseTaskInput } from "@/lib/parse-task";
import { formatWhenDate, toLocalDateStr } from "@/lib/dates";
import { Inbox, Sun, Calendar, BookOpen, CheckSquare, FolderOpen, Layers, Hourglass, Plus } from "lucide-react";
import type { Task } from "@todo/shared";

function taskDestination(task: Task): string {
  if (task.projectId) return `/project/${task.projectId}`;
  if (task.areaId) return `/area/${task.areaId}`;
  if (task.isSomeday) return "/someday";
  const today = toLocalDateStr(new Date());
  if (task.whenDate === today) return "/today";
  if (task.whenDate && task.whenDate > today) return "/upcoming";
  return "/inbox";
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const createTask = useCreateTask();

  const { data: tasks = [] } = useTasks("all", undefined, undefined, { enabled: open });
  const { data: projects = [] } = useProjects(undefined, { enabled: open });
  const { data: areas = [] } = useAreas({ enabled: open });

  const activeProjects = projects.filter((p) => !p.isCompleted);
  const parsed = query.trim() ? parseTaskInput(query, activeProjects) : null;

  useShortcutAction("command-palette", () => setOpen((prev) => !prev));

  function go(href: string) {
    router.push(href);
    setOpen(false);
  }

  async function handleCreateTask() {
    if (!query.trim() || createTask.isPending) return;
    const title = parsed?.title || query.trim();
    await createTask.mutateAsync({
      title,
      whenDate: parsed?.whenDate ?? undefined,
      timeOfDay: parsed?.timeOfDay ?? undefined,
      scheduledTime: parsed?.scheduledTime ?? undefined,
      deadline: parsed?.deadline ?? undefined,
      isSomeday: parsed?.isSomeday ?? false,
      projectId: parsed?.projectId ?? undefined,
    });
    setQuery("");
    setOpen(false);
  }

  return (
    <CommandDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); }}>
      <CommandInput
        placeholder="Search or create a task…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Quick create — shown when there's a typed query */}
        {query.trim() && (
          <CommandGroup heading="Create">
            <CommandItem
              value={`create:${query}`}
              onSelect={handleCreateTask}
              disabled={createTask.isPending}
            >
              <Plus className="mr-2 h-4 w-4 text-primary" />
              <span className="flex-1">
                Create &ldquo;{parsed?.title || query.trim()}&rdquo;
              </span>
              {parsed?.whenDate && (
                <span className="text-xs text-muted-foreground ml-2">{formatWhenDate(parsed.whenDate)}</span>
              )}
              {parsed?.projectName && (
                <span className="text-xs text-muted-foreground ml-2">→ {parsed.projectName}</span>
              )}
            </CommandItem>
          </CommandGroup>
        )}

        {query.trim() && <CommandSeparator />}

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
