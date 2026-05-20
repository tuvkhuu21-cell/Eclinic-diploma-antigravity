import { create } from "zustand";

export type AuthRole = "PATIENT" | "DOCTOR" | "HOSPITAL" | "ADMIN";
export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  role: AuthRole;
};

type AuthState = {
  token?: string;
  role?: AuthRole;
  user?: AuthUser;
  hasHydrated: boolean;
  hydrate: () => void;
  setAuth: (token: string, user?: AuthUser) => void;
  logout: () => void;
};

function persistAuth(token: string, user?: AuthUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem("mediconnect_token", token);
  if (user) localStorage.setItem("mediconnect_user", JSON.stringify(user));
  document.cookie = `mediconnect_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("mediconnect_token");
  localStorage.removeItem("mediconnect_user");
  document.cookie = "mediconnect_token=; path=/; max-age=0; SameSite=Lax";
}

export const useAuthStore = create<AuthState>((set) => ({
  hasHydrated: false,
  hydrate: () => {
    if (typeof window === "undefined") {
      set({ hasHydrated: true });
      return;
    }
    try {
      const token = localStorage.getItem("mediconnect_token") || undefined;
      const rawUser = localStorage.getItem("mediconnect_user");
      let user: AuthUser | undefined;
      if (rawUser) {
        try {
          user = JSON.parse(rawUser) as AuthUser;
        } catch {
          localStorage.removeItem("mediconnect_user");
        }
      }
      set({ token, user, role: user?.role, hasHydrated: true });
    } catch {
      set({ token: undefined, user: undefined, role: undefined, hasHydrated: true });
    }
  },
  setAuth: (token, user) => {
    persistAuth(token, user);
    set({ token, user, role: user?.role, hasHydrated: true });
  },
  logout: () => {
    clearAuth();
    set({ token: undefined, user: undefined, role: undefined, hasHydrated: true });
  },
}));
