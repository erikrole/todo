import { AppShell } from "@/components/layout/app-shell";

export default function ViewsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
