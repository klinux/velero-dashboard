"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Center, Loader } from "@mantine/core";
import { useAuthStore, type AuthMode } from "@/lib/auth";
import { getAuthConfig } from "@/lib/api";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, authMode, setAuthMode, setAuth, initialize } =
    useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initialize();

    getAuthConfig()
      .then((config) => {
        const mode = config.mode as AuthMode;
        setAuthMode(mode);
        if (mode === "none") {
          setAuth("none", "anonymous", "admin");
        }
      })
      .catch(() => {
        setAuthMode("none");
        setAuth("none", "anonymous", "admin");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    if (authMode === "none") return;
    if (!isAuthenticated && !PUBLIC_PATHS.includes(pathname)) {
      router.push("/login");
    }
  }, [loading, isAuthenticated, authMode, pathname, router]);

  if (loading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (
    authMode !== "none" &&
    !isAuthenticated &&
    !PUBLIC_PATHS.includes(pathname)
  ) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  return <>{children}</>;
}
