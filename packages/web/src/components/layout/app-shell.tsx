"use client";

import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "./sidebar";
import { TaskDndProvider } from "@/components/dnd/task-dnd-provider";
import { useShortcutAction } from "@/components/keyboard/keyboard-provider";
import { ShortcutsOverlay } from "@/components/keyboard/shortcuts-overlay";

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
        <KeyboardNavigationHandlers />
        <ShortcutsOverlay />
        <AppSidebar />
        <main className="flex flex-1 flex-col min-h-screen">
          <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
            <SidebarTrigger />
          </header>
          <div className="flex flex-1 flex-col p-6">{children}</div>
        </main>
      </SidebarProvider>
    </TaskDndProvider>
  );
}
