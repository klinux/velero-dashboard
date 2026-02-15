"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Center, Loader, Text, Stack } from "@mantine/core";
import { useAuthStore, type Role } from "@/lib/auth";
import { getMe } from "@/lib/api";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      router.push("/login");
      return;
    }

    // Temporarily store token so getMe() can use it
    localStorage.setItem("velero_token", token);

    getMe()
      .then((user) => {
        setAuth(token, user.username, user.role as Role);
        router.push("/");
      })
      .catch(() => {
        localStorage.removeItem("velero_token");
        router.push("/login");
      });
  }, [searchParams, setAuth, router]);

  return (
    <Center h="100vh">
      <Stack align="center">
        <Loader size="lg" />
        <Text c="dimmed">Completing authentication...</Text>
      </Stack>
    </Center>
  );
}
