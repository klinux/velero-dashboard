"use client";

import { NavLink } from "@mantine/core";
import {
  IconDashboard,
  IconDatabaseExport,
  IconDatabaseImport,
  IconCalendarEvent,
  IconSettings,
  IconServer,
} from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore, hasRole } from "@/lib/auth";

const links = [
  { href: "/", label: "Dashboard", icon: IconDashboard, minRole: null },
  { href: "/backups", label: "Backups", icon: IconDatabaseExport, minRole: null },
  { href: "/restores", label: "Restores", icon: IconDatabaseImport, minRole: null },
  { href: "/schedules", label: "Schedules", icon: IconCalendarEvent, minRole: null },
  { href: "/settings", label: "Settings", icon: IconSettings, minRole: "admin" as const },
  { href: "/clusters", label: "Clusters", icon: IconServer, minRole: "admin" as const },
];

export function NavLinks() {
  const pathname = usePathname();
  const { role } = useAuthStore();

  return (
    <>
      {links
        .filter((link) => {
          if (!link.minRole) return true;
          return hasRole(role, link.minRole);
        })
        .map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <NavLink
              key={link.href}
              component={Link}
              href={link.href}
              label={link.label}
              leftSection={<link.icon size={20} stroke={1.5} />}
              active={isActive}
              variant={isActive ? "light" : "subtle"}
            />
          );
        })}
    </>
  );
}
