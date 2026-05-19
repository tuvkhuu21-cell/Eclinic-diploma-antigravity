"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/auth.store";
import { isSupabaseRealtimeEnabled, removeRealtimeChannel, subscribeBroadcast } from "@/lib/supabase-realtime";

type NotificationRow = {
  id: string;
  title: string;
  body?: string | null;
  type?: string | null;
  readAt?: string | null;
};

export function ChatIconLink({ className, iconSize = 19 }: { className?: string; iconSize?: number }) {
  const user = useAuthStore((state) => state.user);
  const [chatNotifications, setChatNotifications] = useState<NotificationRow[]>([]);
  const realtimeEnabled = isSupabaseRealtimeEnabled();
  const unreadCount = useMemo(() => chatNotifications.filter((item) => !item.readAt).length, [chatNotifications]);

  useEffect(() => {
    if (!user?.id) {
      setChatNotifications([]);
      return;
    }

    let cancelled = false;
    async function loadUnreadChatNotifications() {
      try {
        const response = await api.get("/notifications");
        if (cancelled) return;
        setChatNotifications(((response.data.data || []) as NotificationRow[]).filter(isChatNotification));
      } catch {
        if (!cancelled) setChatNotifications([]);
      }
    }

    void loadUnreadChatNotifications();
    const refreshTimer = realtimeEnabled ? null : window.setInterval(loadUnreadChatNotifications, 90_000);
    const channel = subscribeBroadcast<NotificationRow>(`user-notifications-${user.id}`, "new-notification", (notification) => {
      if (!isChatNotification(notification)) return;
      setChatNotifications((current) => [notification, ...current.filter((item) => item.id !== notification.id)]);
    });

    return () => {
      cancelled = true;
      if (refreshTimer) window.clearInterval(refreshTimer);
      removeRealtimeChannel(channel);
    };
  }, [user?.id, realtimeEnabled]);

  function markChatRead() {
    const unread = chatNotifications.filter((item) => !item.readAt);
    if (unread.length === 0) return;
    const readAt = new Date().toISOString();
    setChatNotifications((current) => current.map((item) => unread.some((row) => row.id === item.id) ? { ...item, readAt } : item));
    void Promise.all(unread.map((item) => api.patch(`/notifications/${item.id}/read`).catch(() => null)));
  }

  return (
    <Link href="/chat" prefetch={false} aria-label="Chat" className={cn("relative grid h-11 w-11 place-items-center rounded-full transition hover:bg-cyanSoft", className)} onClick={markChatRead}>
      <MessageCircle size={iconSize} />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white ring-2 ring-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

function isChatNotification(notification: NotificationRow) {
  const type = (notification.type || "").toUpperCase();
  const title = notification.title.toLowerCase();
  const body = (notification.body || "").toLowerCase();
  return type === "CHAT" || title.includes("chat") || title.includes("чат") || body.includes("chat") || body.includes("чат");
}
