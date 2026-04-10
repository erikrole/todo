"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./sidebar";
import { TaskDndProvider } from "@/components/dnd/task-dnd-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TaskDndProvider>
      <SidebarProvider>
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
