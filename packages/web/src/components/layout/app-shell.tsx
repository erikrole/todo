"use client";

import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "./sidebar";
import { TaskDndProvider } from "@/components/dnd/task-dnd-provider";
import { useShortcutAction } from "@/components/keyboard/keyboard-provider";
import { ShortcutsOverlay } from "@/components/keyboard/shortcuts-overlay";
import { SelectionProvider } from "@/hooks/use-selection";
import { BulkActionBar } from "@/components/tasks/bulk-action-bar";

/** Registers navigation shortcuts that need router + sidebar access. */
function KeyboardNavigationHandlers() {
  const router = useRouter();
  const { toggleSidebar } = useSidebar();

  useShortcutAction("navigate-today",    () => router.push("/today"));
  useShortcutAction("navigate-inbox",    () => router.push("/inbox"));
  useShortcutAction("navigate-upcoming", () => router.push("/upcoming"));
  useShortcutAction("navigate-someday",  () => router.push("/someday"));
  useShortcutAction("navigate-logbook",  () => router.push("/logbook"));
  useShortcutAction("toggle-sidebar",    toggleSidebar);

  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TaskDndProvider>
      <SidebarProvider>
        <SelectionProvider>
          <KeyboardNavigationHandlers />
          <ShortcutsOverlay />
          <BulkActionBar />
          <AppSidebar />
          <main className="flex flex-1 flex-col min-h-screen">
            <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
              <SidebarTrigger />
            </header>
            <div className="relative flex flex-1 flex-col p-6">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-32"
                style={{
                  background:
                    "linear-gradient(to bottom, color-mix(in oklch, var(--primary) 9%, transparent) 0%, color-mix(in oklch, var(--primary) 3%, transparent) 60%, transparent 100%)",
                }}
              />
              <div className="relative">{children}</div>
            </div>
          </main>
        </SelectionProvider>
      </SidebarProvider>
    </TaskDndProvider>
  );
}
