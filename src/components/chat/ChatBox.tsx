"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Paperclip, Search, Send, Smile, Video } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { DoctorOnlineStatus } from "./DoctorOnlineStatus";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/auth.store";
import { broadcastRealtime, isSupabaseRealtimeEnabled, removeRealtimeChannel, subscribeBroadcast, subscribeUserPresence } from "@/lib/supabase-realtime";

type ChatRoom = {
  id: string;
  patient: { user: { id?: string; firstName: string; lastName?: string } };
  doctor: { id: string; user: { id?: string; firstName: string; lastName?: string }; specialty: string; online?: boolean };
  appointment?: {
    id: string;
    type?: string;
    scheduledAt: string;
    durationMinutes?: number;
    videoCall?: { roomId: string; status?: string } | null;
  } | null;
};

type ChatMessage = {
  id: string;
  content: string;
  senderId: string;
  createdAt?: string;
  status?: "sending" | "failed";
};

const emojiOptions = ["😀", "😄", "😊", "😍", "🥰", "😂", "😎", "🤔", "👍", "👏", "🙏", "💪", "❤️", "💙", "💚", "✨", "🔥", "🎉", "😷", "🤒", "💊", "🩺", "🏥", "✅"];

export function ChatBox() {
  const user = useAuthStore((state) => state.user);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [unreadRoomIds, setUnreadRoomIds] = useState<Set<string>>(new Set());
  const [patientPresenceByUserId, setPatientPresenceByUserId] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialScrollDoneRef = useRef(false);
  const latestMessageAtRef = useRef("");
  const realtimeEnabled = isSupabaseRealtimeEnabled();
  const pathname = usePathname();

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!emojiRef.current?.contains(event.target as Node)) setEmojiOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    let firstLoad = true;
    let cancelled = false;
    let retryTimer: number | undefined;
    async function loadRooms() {
      try {
        const response = await api.get("/chat/rooms");
        if (cancelled) return;
        const rows = response.data.data as ChatRoom[];
        setRooms(rows);
        setUnreadRoomIds((current) => current.size ? current : new Set(rows.map((room) => room.id)));
        if (firstLoad) {
          const requestedRoom = new URLSearchParams(window.location.search).get("roomId");
          const initialRoomId = requestedRoom || rows[0]?.id || "";
          setActiveRoomId(initialRoomId);
          if (initialRoomId) {
            setUnreadRoomIds((current) => {
              const next = new Set(current);
              next.delete(initialRoomId);
              return next;
            });
          }
          firstLoad = false;
          // If rooms came back empty, retry once after 1.5s (covers race conditions after video call)
          if (rows.length === 0 && !retryTimer) {
            retryTimer = window.setTimeout(() => { if (!cancelled) loadRooms(); }, 1500);
          }
        }
      } catch {
        if (!cancelled) setRooms([]);
      }
    }
    loadRooms();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [pathname]);

  const refreshMessages = useCallback(async (roomId: string, options?: { clearOnError?: boolean }) => {
    try {
      const params = latestMessageAtRef.current ? { since: latestMessageAtRef.current, limit: 50 } : { limit: 50 };
      const response = await api.get(`/chat/rooms/${roomId}/messages`, { params });
      const rows = normalizeMessages(response.data.data as ChatMessage[]);
      if (rows.at(-1)?.createdAt) latestMessageAtRef.current = rows.at(-1)?.createdAt || latestMessageAtRef.current;
      setMessages((current) => mergeMessages(current, rows));
    } catch {
      if (options?.clearOnError) setMessages([]);
    }
  }, []);

  useEffect(() => {
    if (!activeRoomId) {
      setMessages([]);
      return;
    }
    initialScrollDoneRef.current = false;
    latestMessageAtRef.current = "";

    let cancelled = false;
    async function loadMessages() {
      try {
        const response = await api.get(`/chat/rooms/${activeRoomId}/messages`, { params: { limit: 50 } });
        if (!cancelled) {
          const rows = normalizeMessages(response.data.data as ChatMessage[]);
          latestMessageAtRef.current = rows.at(-1)?.createdAt || "";
          setMessages(rows);
        }
      } catch {
        if (!cancelled) setMessages([]);
      }
    }

    loadMessages();
    const channel = subscribeBroadcast<ChatMessage>(`chat-room-${activeRoomId}`, "new-message", (message) => {
      if (message.createdAt && message.createdAt > latestMessageAtRef.current) latestMessageAtRef.current = message.createdAt;
      setMessages((current) => mergeMessages(current, [message]));
      if (message.senderId !== user?.id) {
        setUnreadRoomIds((current) => {
          const next = new Set(current);
          next.add(activeRoomId);
          return next;
        });
      }
    });
    const timer = realtimeEnabled ? null : window.setInterval(() => {
      void refreshMessages(activeRoomId);
    }, 5_000);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      removeRealtimeChannel(channel);
    };
  }, [activeRoomId, refreshMessages, realtimeEnabled, user?.id]);

  useEffect(() => {
    const element = messagesRef.current;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (!initialScrollDoneRef.current || distanceFromBottom < 180) {
      window.requestAnimationFrame(() => {
        element.scrollTop = element.scrollHeight;
        messagesEndRef.current?.scrollIntoView({ block: "end" });
      });
      initialScrollDoneRef.current = true;
    }
  }, [messages]);

  const activeRoom = useMemo(() => rooms.find((room) => room.id === activeRoomId), [activeRoomId, rooms]);
  const activeOnlineAppointment = activeRoom?.appointment?.type === "ONLINE" || (activeRoom?.appointment && !activeRoom.appointment.type);
  const activeTitle = activeRoom ? (user?.role === "DOCTOR" ? `${activeRoom.patient.user.lastName || ""} ${activeRoom.patient.user.firstName}`.trim() : `${activeRoom.doctor.user.lastName || ""} ${activeRoom.doctor.user.firstName}`.trim()) : "Чат сонгоно уу";
  const activeInitials = getInitials(activeTitle);
  const activeOtherOnline = Boolean(activeRoom && (
    user?.role === "DOCTOR"
      ? patientPresenceByUserId[activeRoom.patient.user.id || ""]
      : activeRoom.doctor.online
  ));
  const visibleRooms = useMemo(() => rooms.filter((room) => {
    const doctorName = `${room.doctor.user.lastName || ""} ${room.doctor.user.firstName}`.trim();
    const patientName = `${room.patient.user.lastName || ""} ${room.patient.user.firstName}`.trim();
    const title = user?.role === "DOCTOR" ? patientName : doctorName;
    const matchesSearch = title.toLowerCase().includes(searchTerm.trim().toLowerCase()) || room.doctor.specialty.toLowerCase().includes(searchTerm.trim().toLowerCase());
    const matchesFilter = filter === "all" || unreadRoomIds.has(room.id);
    return matchesSearch && matchesFilter;
  }), [filter, rooms, searchTerm, unreadRoomIds, user?.role]);

  useEffect(() => {
    if (user?.role !== "DOCTOR" || !rooms.length) {
      setPatientPresenceByUserId({});
      return;
    }
    const patientUserIds = Array.from(new Set(rooms.map((room) => room.patient.user.id).filter(Boolean))) as string[];
    const channels = patientUserIds.map((patientUserId) => subscribeUserPresence(patientUserId, (online) => {
      setPatientPresenceByUserId((current) => ({ ...current, [patientUserId]: online }));
    }));
    return () => channels.forEach((channel) => removeRealtimeChannel(channel));
  }, [rooms, user?.role]);

  function selectRoom(roomId: string) {
    setActiveRoomId(roomId);
    setUnreadRoomIds((current) => {
      const next = new Set(current);
      next.delete(roomId);
      return next;
    });
  }

  async function sendMessage() {
    const content = draft.trim();
    if (!activeRoomId || !content) return;
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      content,
      senderId: user?.id || "me",
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => mergeMessages(current, [optimisticMessage]));
    setDraft("");
    try {
      const response = await api.post("/chat/messages", { roomId: activeRoomId, content });
      const saved = response.data.data as ChatMessage;
      if (saved.createdAt && saved.createdAt > latestMessageAtRef.current) latestMessageAtRef.current = saved.createdAt;
      setMessages((current) => mergeMessages(current.filter((message) => message.id !== tempId), [saved]));
      void broadcastRealtime(`chat-room-${activeRoomId}`, "new-message", saved);
    } catch {
      setMessages((current) => current.map((message) => message.id === tempId ? { ...message, status: "failed" } : message));
    }
  }

  async function sendAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!activeRoomId || !file || uploading) return;
    setUploading(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const uploadResponse = await api.post("/chat/upload", data, { headers: { "Content-Type": "multipart/form-data" } });
      const attachment = uploadResponse.data.data as { url: string; name: string; mimeType: string; size: number };
      const payload = JSON.stringify({ text: draft.trim(), attachment });
      const tempId = `temp-${Date.now()}`;
      setMessages((current) => mergeMessages(current, [{
        id: tempId,
        content: payload,
        senderId: user?.id || "me",
        createdAt: new Date().toISOString(),
        status: "sending",
      }]));
      const response = await api.post("/chat/messages", { roomId: activeRoomId, content: payload });
      const saved = response.data.data as ChatMessage;
      if (saved.createdAt && saved.createdAt > latestMessageAtRef.current) latestMessageAtRef.current = saved.createdAt;
      setMessages((current) => mergeMessages(current.filter((message) => message.id !== tempId), [saved]));
      setDraft("");
      void broadcastRealtime(`chat-room-${activeRoomId}`, "new-message", saved);
    } catch {
      setMessages((current) => current.map((message) => message.status === "sending" ? { ...message, status: "failed" } : message));
    } finally {
      setUploading(false);
    }
  }

  function insertEmoji(emoji: string) {
    const input = messageInputRef.current;
    if (!input) {
      setDraft((current) => `${current}${emoji}`);
      return;
    }
    const start = input.selectionStart ?? draft.length;
    const end = input.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    setDraft(next);
    window.requestAnimationFrame(() => {
      input.focus();
      const cursor = start + emoji.length;
      input.setSelectionRange(cursor, cursor);
    });
  }

  async function startVideoCall() {
    if (!activeRoom?.appointment) return;
    const existingRoomId = activeRoom.appointment.videoCall?.roomId;
    if (existingRoomId) {
      void startVideoCallInBackground({
        roomId: existingRoomId,
        doctorId: activeRoom.doctor.id,
        appointmentId: activeRoom.appointment.id,
        recipientUserId: user?.role === "DOCTOR" ? activeRoom.patient.user.id : activeRoom.doctor.user.id,
        callerName: user?.role === "DOCTOR"
          ? `${activeRoom.doctor.user.lastName || ""} ${activeRoom.doctor.user.firstName}`.trim()
          : `${activeRoom.patient.user.lastName || ""} ${activeRoom.patient.user.firstName}`.trim(),
        callerId: user?.id,
      });
      window.location.href = `/video-call/${existingRoomId}?start=1`;
      return;
    }
    const response = await api.post("/video-calls", {
      doctorId: activeRoom.doctor.id,
      appointmentId: activeRoom.appointment.id,
    });
    const call = response.data.data as { roomId: string; status?: string };
    const roomId = call.roomId;
    const recipientUserId = user?.role === "DOCTOR" ? activeRoom.patient.user.id : activeRoom.doctor.user.id;
    if (call.status !== "active") {
      await api.patch("/video-calls", { roomId, status: "ringing" }).catch(() => null);
      if (recipientUserId) {
        void broadcastRealtime(`user-notifications-${recipientUserId}`, "incoming-video-call", {
          roomId,
          appointmentId: activeRoom.appointment.id,
          callerId: user?.id,
          callerName: user?.role === "DOCTOR"
            ? `${activeRoom.doctor.user.lastName || ""} ${activeRoom.doctor.user.firstName}`.trim()
            : `${activeRoom.patient.user.lastName || ""} ${activeRoom.patient.user.firstName}`.trim(),
        });
      }
      void broadcastRealtime(`video-call-${roomId}`, "call-ringing", {
        roomId,
        appointmentId: activeRoom.appointment.id,
        callerId: user?.id,
      });
    }
    window.location.href = `/video-call/${roomId}${call.status === "active" ? "?accept=1" : "?start=1"}`;
  }

  return (
    <div className="mx-auto grid h-[calc(100vh-110px)] min-h-[680px] max-w-[1480px] overflow-hidden rounded-[30px] border border-emerald-100 bg-white shadow-[0_20px_70px_rgba(25,105,89,0.12)] lg:grid-cols-[360px_minmax(520px,1fr)]">
        <aside className="hidden min-h-0 flex-col border-r border-emerald-100 bg-white lg:flex">
          <div className="border-b border-emerald-100 p-5">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-black tracking-tight text-slate-950">Chats</h1>
            </div>
            <label className="mt-5 flex h-12 items-center gap-3 rounded-full bg-[#f0f8f4] px-4 text-slate-500 ring-1 ring-emerald-100">
              <Search size={22} />
              <input className="min-w-0 flex-1 bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:text-slate-500" placeholder="Search Messenger" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
            </label>
            <div className="mt-4 flex items-center gap-3 text-sm font-extrabold text-slate-900">
              <button type="button" className={`rounded-full px-4 py-2 ${filter === "all" ? "bg-cyanSoft text-medical" : "hover:bg-emerald-50"}`} onClick={() => setFilter("all")}>All</button>
              <button type="button" className={`rounded-full px-4 py-2 ${filter === "unread" ? "bg-cyanSoft text-medical" : "hover:bg-emerald-50"}`} onClick={() => setFilter("unread")}>Unread</button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
            <div className="grid gap-1">
            {visibleRooms.map((room) => {
              const doctorName = `${room.doctor.user.lastName || ""} ${room.doctor.user.firstName}`.trim();
              const patientName = `${room.patient.user.lastName || ""} ${room.patient.user.firstName}`.trim();
              const title = user?.role === "DOCTOR" ? patientName : doctorName;
              const lastPreview = room.appointment?.type === "ONLINE" ? "Онлайн зөвлөгөө" : room.doctor.specialty;
              return (
                <button key={room.id} type="button" className={`flex items-center gap-3 rounded-2xl p-3 text-left transition ${activeRoomId === room.id ? "bg-cyanSoft" : "hover:bg-emerald-50"}`} onClick={() => selectRoom(room.id)}>
                  <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-100 to-cyanSoft text-lg font-black text-medical">
                    {getInitials(title)}
                    <span className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white ${user?.role === "DOCTOR" ? (patientPresenceByUserId[room.patient.user.id || ""] ? "bg-emerald-500" : "bg-slate-300") : room.doctor.online ? "bg-emerald-500" : "bg-slate-300"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-extrabold text-slate-950">{title}</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-slate-500">{lastPreview}</p>
                  </div>
                  {unreadRoomIds.has(room.id) && <span className="h-2.5 w-2.5 rounded-full bg-medical" />}
                </button>
              );
            })}
            {visibleRooms.length === 0 && <p className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-slate-500">Чат олдсонгүй.</p>}
            </div>
          </div>
        </aside>
        <main className="flex min-h-0 flex-col bg-white">
          <div className="flex h-20 items-center justify-between border-b border-emerald-100 px-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="relative grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-emerald-100 to-cyanSoft text-base font-black text-medical">
                {activeInitials}
                {activeRoom && <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${activeOtherOnline ? "bg-emerald-500" : "bg-slate-300"}`} />}
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-950">{activeTitle}</h2>
                <div className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-slate-500">
                  <span>{activeRoom ? (activeOtherOnline ? "Active now" : "Offline") : "Чат сонгоно уу"}</span>
                  {activeRoom && user?.role !== "DOCTOR" && <DoctorOnlineStatus online={activeRoom?.doctor.online} />}
                </div>
              </div>
            </div>
            {activeRoom?.appointment && (
              <div className="flex items-center gap-3 text-medical">
                {activeOnlineAppointment && (
                  <button type="button" title="Видео дуудлага" aria-label="Видео дуудлага" className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-cyanSoft" onClick={startVideoCall}>
                    <Video size={23} />
                  </button>
                )}
              </div>
            )}
          </div>
          {activeRoom?.appointment && (
            <div className="border-b border-emerald-100 px-5 py-2 text-xs font-bold text-slate-500">
              <span className="rounded-full bg-cyanSoft px-3 py-1 text-medical">Онлайн зөвлөгөө</span>
              <span className="ml-2">{formatDateTime(activeRoom.appointment.scheduledAt)}</span>
            </div>
          )}
          <div ref={messagesRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto scroll-smooth bg-white px-8 py-5 [scrollbar-color:#b7d8cd_transparent] [scrollbar-width:thin]">
            <div className="mt-auto" />
            {messages.map((message) => <MessageBubble key={message.id} mine={message.senderId === user?.id} text={message.content} status={message.status} />)}
            {activeRoom && messages.length === 0 && <p className="rounded-xl bg-cyanSoft p-4 text-sm font-semibold text-medical">Энэ чатад зурвас алга. Эхний зурвасаа илгээнэ үү.</p>}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex items-center gap-2 border-t border-emerald-100 bg-white p-4">
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={sendAttachment} />
            <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-medical hover:bg-cyanSoft" aria-label="Файл хавсаргах" disabled={!activeRoomId || uploading} onClick={() => fileInputRef.current?.click()}><Paperclip size={20} /></button>
            <div className="flex h-12 flex-1 items-center gap-2 rounded-full bg-[#f0f8f4] px-4 ring-1 ring-emerald-100">
              <input ref={messageInputRef} className="min-w-0 flex-1 bg-transparent text-base font-medium text-slate-900 outline-none placeholder:text-slate-500" placeholder="Aa" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }} disabled={!activeRoomId} />
              <div ref={emojiRef} className="relative">
                <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-medical transition hover:bg-emerald-50 disabled:opacity-40" aria-label="Emoji" disabled={!activeRoomId} onClick={() => setEmojiOpen((open) => !open)}>
                  <Smile size={22} />
                </button>
                {emojiOpen && (
                  <div className="absolute bottom-12 right-0 z-30 grid w-72 grid-cols-8 gap-1 rounded-3xl border border-emerald-100 bg-white p-3 shadow-[0_20px_60px_rgba(25,105,89,0.18)]">
                    {emojiOptions.map((emoji) => (
                      <button key={emoji} type="button" className="grid h-8 w-8 place-items-center rounded-xl text-xl transition hover:bg-cyanSoft" onClick={() => insertEmoji(emoji)}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-medical text-white transition hover:bg-[#1d6758]" aria-label="Илгээх" disabled={!activeRoomId || uploading} onClick={sendMessage}><Send size={18} /></button>
          </div>
        </main>
    </div>
  );
}

async function startVideoCallInBackground(data: { roomId: string; doctorId: string; appointmentId: string; recipientUserId?: string; callerId?: string; callerName: string }) {
  try {
    const response = await api.post("/video-calls", { doctorId: data.doctorId, appointmentId: data.appointmentId });
    const call = response.data.data as { roomId: string; status?: string };
    if (call.status !== "active") await api.patch("/video-calls", { roomId: call.roomId || data.roomId, status: "ringing" }).catch(() => null);
  } catch {
    await api.patch("/video-calls", { roomId: data.roomId, status: "ringing" }).catch(() => null);
  }
  if (data.recipientUserId) {
    void broadcastRealtime(`user-notifications-${data.recipientUserId}`, "incoming-video-call", {
      roomId: data.roomId,
      appointmentId: data.appointmentId,
      callerId: data.callerId,
      callerName: data.callerName,
    });
  }
  void broadcastRealtime(`video-call-${data.roomId}`, "call-ringing", {
    roomId: data.roomId,
    appointmentId: data.appointmentId,
    callerId: data.callerId,
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}.${month}.${day} ${hours}:${minutes}`;
}

function normalizeMessages(rows: ChatMessage[]) {
  return [...rows].sort((first, second) => {
    const firstTime = first.createdAt ? new Date(first.createdAt).getTime() : 0;
    const secondTime = second.createdAt ? new Date(second.createdAt).getTime() : 0;
    return firstTime - secondTime;
  });
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map<string, ChatMessage>();
  for (const message of current) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return normalizeMessages(Array.from(byId.values()));
}

function getInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "MC";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
