"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Title,
  Stack,
  Center,
  Alert,
  Text,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useAuthStore, type Role } from "@/lib/auth";
import { loginBasic, getAuthConfig } from "@/lib/api";
import { VeleroLogo } from "@/components/velero-logo";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, isAuthenticated, authMode, setAuthMode } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && authMode !== "none") {
      router.push("/");
    }
  }, [isAuthenticated, authMode, router]);

  useEffect(() => {
    if (!authMode) {
      getAuthConfig()
        .then((c) => setAuthMode(c.mode as "none" | "basic" | "oidc"))
        .catch(() => setAuthMode("none"));
    }
  }, [authMode, setAuthMode]);

  const handleBasicLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await loginBasic(username, password);
      setAuth(res.token, res.username, res.role as Role);
      router.push("/");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOIDCLogin = () => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    window.location.href = `${apiBase}/api/auth/oidc/login`;
  };

  return (
    <Center h="100vh" style={{ background: "linear-gradient(135deg, var(--mantine-color-indigo-0) 0%, var(--mantine-color-indigo-1) 100%)" }}>
      <Paper shadow="xl" p={40} w={420}>
        <Center mb="md">
          <VeleroLogo size={56} />
        </Center>
        <Title order={2} ta="center" mb="xs">
          Velero Dashboard
        </Title>
        <Text c="dimmed" size="sm" ta="center" mb="lg">
          Kubernetes Backup Management
        </Text>

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            mb="md"
            variant="light"
          >
            {error}
          </Alert>
        )}

        {authMode === "basic" && (
          <form onSubmit={handleBasicLogin}>
            <Stack>
              <TextInput
                label="Username"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.currentTarget.value)}
                required
              />
              <PasswordInput
                label="Password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
              />
              <Button type="submit" fullWidth loading={loading}>
                Sign in
              </Button>
            </Stack>
          </form>
        )}

        {authMode === "oidc" && (
          <Stack>
            <Button fullWidth onClick={handleOIDCLogin} variant="filled">
              Sign in with SSO
            </Button>
          </Stack>
        )}

        {authMode === "none" && (
          <Text c="dimmed" size="sm" ta="center">
            Authentication is disabled. Redirecting...
          </Text>
        )}
      </Paper>
    </Center>
  );
}
