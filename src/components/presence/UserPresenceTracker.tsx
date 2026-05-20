"use client";

import { useEffect } from "react";
import { removeRealtimeChannel, trackUserPresence } from "@/lib/supabase-realtime";
import { useAuthStore } from "@/store/auth.store";

export function UserPresenceTracker() {
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  useEffect(() => {
    if (!hasHydrated || !user?.id || user.role !== "PATIENT") return;
    const channel = trackUserPresence(user.id, { role: user.role });

    function handleUnload() {
      void channel?.untrack();
    }

    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
      void channel?.untrack();
      removeRealtimeChannel(channel);
    };
  }, [hasHydrated, user?.id, user?.role]);

  return null;
}
