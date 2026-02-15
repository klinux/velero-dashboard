import type { Metadata } from "next";
import { ColorSchemeScript } from "@mantine/core";
import { Providers } from "@/components/providers";
import { AuthGuard } from "@/components/auth-guard";
import { DashboardShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Velero Dashboard",
  description: "Kubernetes Backup Management Dashboard",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <Providers>
          <AuthGuard>
            <DashboardShell>{children}</DashboardShell>
          </AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
