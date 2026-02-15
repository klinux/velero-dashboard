import { create } from "zustand";

export type Role = "viewer" | "operator" | "admin";
export type AuthMode = "none" | "basic" | "oidc";

interface AuthState {
  token: string | null;
  username: string | null;
  role: Role | null;
  authMode: AuthMode | null;
  isAuthenticated: boolean;

  setAuth: (token: string, username: string, role: Role) => void;
  setAuthMode: (mode: AuthMode) => void;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  username: null,
  role: null,
  authMode: null,
  isAuthenticated: false,

  setAuth: (token, username, role) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("velero_token", token);
      localStorage.setItem("velero_username", username);
      localStorage.setItem("velero_role", role);
    }
    set({ token, username, role, isAuthenticated: true });
  },

  setAuthMode: (mode) => set({ authMode: mode }),

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("velero_token");
      localStorage.removeItem("velero_username");
      localStorage.removeItem("velero_role");
    }
    set({ token: null, username: null, role: null, isAuthenticated: false });
  },

  initialize: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("velero_token");
    const username = localStorage.getItem("velero_username");
    const role = localStorage.getItem("velero_role") as Role | null;
    if (token && username && role) {
      set({ token, username, role, isAuthenticated: true });
    }
  },
}));

export function hasRole(userRole: Role | null, requiredRole: Role): boolean {
  const levels: Record<Role, number> = { viewer: 1, operator: 2, admin: 3 };
  if (!userRole) return false;
  return levels[userRole] >= levels[requiredRole];
}
