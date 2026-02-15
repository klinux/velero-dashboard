"use client";

import { AppShell } from "@mantine/core";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell padding="lg">
      <AppShell.Main>
        <h1>Minimal Shell - Testing</h1>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
