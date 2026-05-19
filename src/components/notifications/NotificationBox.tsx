"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationItem } from "./NotificationItem";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/auth.store";
import { removeRealtimeChannel, subscribeBroadcast } from "@/lib/supabase-realtime";

type NotificationRow = {
  id: string;
  title: string;
  body?: string | null;
  type?: string | null;
  createdAt: string;
  readAt?: string | null;
};

export function NotificationBox({ variant = "list", buttonClassName }: { variant?: "list" | "dropdown"; buttonClassName?: string }) {
  const router = useRouter();
  const { user, role } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [todayKey, setTodayKey] = useState(() => formatDate(new Date().toISOString()));
  const rootRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((item) => !item.readAt && formatDate(item.createdAt) === todayKey).length;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setTodayKey(formatDate(new Date().toISOString())), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadNotifications() {
      try {
        const response = await api.get("/notifications");
        if (!cancelled) setNotifications(response.data.data);
      } catch {
        if (!cancelled) setNotifications([]);
      }
    }

    loadNotifications();
    const refreshTimer = window.setInterval(loadNotifications, 5_000);
    const channel = user?.id ? subscribeBroadcast<NotificationRow>(`user-notifications-${user.id}`, "new-notification", (notification) => {
      setNotifications((current) => [notification, ...current.filter((item) => item.id !== notification.id)]);
    }) : null;
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      removeRealtimeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    const visibleUnread = notifications.filter((item) => !item.readAt && formatDate(item.createdAt) === todayKey).slice(0, 8);
    if (visibleUnread.length === 0) return;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => visibleUnread.some((row) => row.id === item.id) ? { ...item, readAt } : item));
    void Promise.all(visibleUnread.map((item) => api.patch(`/notifications/${item.id}/read`).catch(() => null)));
  }, [open, notifications, todayKey]);

  function handleNotificationClick(notification: NotificationRow) {
    const href = inferNotificationHref(notification, user?.role || role);
    if (!href) return;
    setOpen(false);
    router.push(href);
  }

  if (variant === "list") {
    return (
      <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
        <DropdownContent
          notifications={notifications}
          onClose={() => setOpen(false)}
          onNavigate={() => setOpen(false)}
          onNotificationClick={handleNotificationClick}
          todayKey={todayKey}
          showClose={false}
        />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        className={cn("relative grid h-11 w-11 place-items-center rounded-full border border-emerald-100 bg-white text-navy shadow-sm transition hover:bg-cyanSoft", buttonClassName)}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-14 z-50 w-[calc(100vw-2rem)] max-w-[400px] overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-[0_24px_70px_rgba(25,105,89,0.20)]">
          <DropdownContent
            notifications={notifications}
            onClose={() => setOpen(false)}
            onNavigate={() => setOpen(false)}
            onNotificationClick={handleNotificationClick}
            todayKey={todayKey}
          />
        </div>
      )}
    </div>
  );
}

function DropdownContent({
  notifications,
  onClose,
  onNavigate,
  onNotificationClick,
  todayKey,
  showClose = true,
}: {
  notifications: NotificationRow[];
  onClose: () => void;
  onNavigate: () => void;
  onNotificationClick: (notification: NotificationRow) => void;
  todayKey: string;
  showClose?: boolean;
}) {
  const rows = notifications.filter((item) => formatDate(item.createdAt) === todayKey).slice(0, 8);
  const groups = groupNotifications(rows);

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between border-b border-emerald-50 px-5 py-4">
        <h2 className="text-base font-extrabold text-navy">Мэдэгдэл</h2>
        {showClose && (
          <button type="button" aria-label="Close notifications" className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-emerald-50 hover:text-medical" onClick={onClose}>
            <X size={18} />
          </button>
        )}
      </div>
      <div className="max-h-[420px] overflow-y-auto px-4 py-4 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
        {rows.length === 0 && (
          <p className="rounded-2xl border border-dashed border-sky-100 bg-cyanSoft p-4 text-sm font-semibold text-medical">Өнөөдрийн мэдэгдэл алга.</p>
        )}
        {groups.map((group) => (
          <section key={group.date} className="mb-4 last:mb-0">
            <p className="mb-2 px-1 text-xs font-bold text-slate-400">{group.date}</p>
            <div className="grid gap-3">
              {group.items.map((item) => (
                <NotificationItem
                  key={item.id}
                  title={item.title}
                  description={item.body || ""}
                  time={formatTime(item.createdAt)}
                  unread={!item.readAt}
                  onClick={() => onNotificationClick(item)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      <Link href="/notifications" onClick={onNavigate} className="block border-t border-emerald-50 px-5 py-4 text-center text-sm font-bold text-medical transition hover:bg-cyanSoft">
        Бүх мэдэгдэл харах
      </Link>
    </div>
  );
}

function groupNotifications(notifications: NotificationRow[]) {
  const groups: Array<{ date: string; items: NotificationRow[] }> = [];
  notifications.forEach((notification) => {
    const date = formatDate(notification.createdAt);
    const group = groups.find((item) => item.date === date);
    if (group) group.items.push(notification);
    else groups.push({ date, items: [notification] });
  });
  return groups;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Огноо тодорхойгүй";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function inferNotificationHref(notification: NotificationRow, role?: string | null) {
  const type = (notification.type || "").toUpperCase();
  const title = notification.title.toLowerCase();
  const body = (notification.body || "").toLowerCase();

  if (type === "CHAT" || title.includes("chat") || body.includes("чат")) return "/chat";
  if (type === "PAYMENT") return "/dashboard/patient?section=appointments";
  if (type === "APPOINTMENT") {
    if (role === "DOCTOR") return "/dashboard/doctor";
    if (title.includes("онлайн") || body.includes("онлайн") || body.includes("цаг")) return "/dashboard/patient?section=appointments";
    return "/dashboard/doctor";
  }
  return "";
}
