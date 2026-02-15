"use client";

import {
  AppShell,
  Burger,
  Group,
  Title,
  ActionIcon,
  useMantineColorScheme,
  Text,
  Badge,
  Avatar,
  Stack,
  Divider,
  ScrollArea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconSun, IconMoon, IconLogout } from "@tabler/icons-react";
import { NavLinks } from "./nav-links";
import { VeleroLogo } from "./velero-logo";
import { ClusterSelector } from "./cluster-selector";
import { useWebSocket } from "@/hooks/use-ws";
import { useClusterAutoSelect } from "@/hooks/use-cluster-auto-select";
import { useAuthStore } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useClusterStore } from "@/lib/cluster";
import { useEffect } from "react";

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/[.\-_@\s]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const { username, role, authMode, logout } = useAuthStore();
  const initialize = useClusterStore((state) => state.initialize);
  const router = useRouter();

  // Initialize cluster store from localStorage (run once on mount)
  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize WebSocket for real-time updates
  useWebSocket();

  // Auto-select a cluster if none is selected or if selected was deleted
  useClusterAutoSelect();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 260,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <VeleroLogo size={32} />
            <Title order={3} fw={700}>
              Velero
            </Title>
          </Group>
          <Group gap="md">
            
            <ClusterSelector />
            {authMode && authMode !== "none" && (
              <>
                <Avatar
                  size="sm"
                  radius="xl"
                  color="indigo"
                  variant="filled"
                >
                  {getInitials(username)}
                </Avatar>
                <div>
                  <Text size="sm" fw={500} lh={1.2}>
                    {username}
                  </Text>
                  <Badge size="xs" variant="light" color="indigo">
                    {role}
                  </Badge>
                </div>
                <ActionIcon
                  onClick={handleLogout}
                  title="Logout"
                  color="gray"
                >
                  <IconLogout size={18} />
                </ActionIcon>
              </>
            )}
            <ActionIcon
              onClick={toggleColorScheme}
              size="lg"
              aria-label="Toggle color scheme"
              color="gray"
            >
              {colorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs" px="sm">
            Navigation
          </Text>
        </AppShell.Section>
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={4}>
            <NavLinks />
          </Stack>
        </AppShell.Section>
        {authMode && authMode !== "none" && (
          <AppShell.Section>
            <Divider my="sm" />
            <Group px="sm" pb="xs">
              <Avatar size="sm" radius="xl" color="indigo" variant="light">
                {getInitials(username)}
              </Avatar>
              <div style={{ flex: 1 }}>
                <Text size="xs" fw={500} truncate>
                  {username}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {role}
                </Text>
              </div>
            </Group>
          </AppShell.Section>
        )}
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
