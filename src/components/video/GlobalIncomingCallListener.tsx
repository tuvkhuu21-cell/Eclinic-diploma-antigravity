"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PhoneOff, Video, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { broadcastRealtime, removeRealtimeChannel, subscribeBroadcast } from "@/lib/supabase-realtime";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/services/api";

const RINGING_TIMEOUT_MS = 30_000;

type RingtoneNode = {
  oscillator: OscillatorNode;
  gain: GainNode;
  context: AudioContext;
};

const activeRingtones = new Set<RingtoneNode>();

type IncomingVideoCall = {
  roomId: string;
  appointmentId?: string;
  callerId?: string;
  callerName?: string;
  patient?: { user?: { firstName?: string; lastName?: string } };
  doctor?: { user?: { firstName?: string; lastName?: string } };
};

export function GlobalIncomingCallListener() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const [incoming, setIncoming] = useState<IncomingVideoCall | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const ignoredRoomIdsRef = useRef<Set<string>>(new Set());
  const userId = user?.id ?? null;
  const enabled = Boolean(userId);
  const isVideoPage = pathname?.startsWith("/video-call");

  const callerName = useMemo(() => incoming?.callerName || "MediConnect хэрэглэгч", [incoming?.callerName]);

  useEffect(() => {
    if (!isVideoPage) return;
    stopAllRingtones();
    setIncoming(null);
  }, [isVideoPage]);

  useEffect(() => {
    if (!enabled || !userId || isVideoPage) return;
    const channel = subscribeBroadcast<IncomingVideoCall>(`user-notifications-${userId}`, "incoming-video-call", (payload) => {
      if (payload.callerId && payload.callerId === userId) return;
      if (ignoredRoomIdsRef.current.has(payload.roomId)) return;
      setIncoming(payload);
    });
    return () => removeRealtimeChannel(channel);
  }, [enabled, userId, isVideoPage]);

  useEffect(() => {
    if (!enabled || !userId || isVideoPage || incoming) return;
    let cancelled = false;

    async function checkIncomingCall() {
      try {
        const response = await api.get("/video-calls", { params: { status: "ringing" } });
        if (cancelled) return;
        const calls = (response.data.data || []) as IncomingVideoCall[];
        const call = calls.find((item) => item.roomId && !ignoredRoomIdsRef.current.has(item.roomId));
        if (!call) return;
        const caller = user?.role === "DOCTOR" ? call.patient?.user : call.doctor?.user;
        setIncoming({
          roomId: call.roomId,
          appointmentId: call.appointmentId,
          callerName: `${caller?.lastName || ""} ${caller?.firstName || ""}`.trim() || "MediConnect хэрэглэгч",
        });
      } catch {
        // Keep the fallback quiet during LAN/API hiccups.
      }
    }

    void checkIncomingCall();
    const timer = window.setInterval(checkIncomingCall, 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, userId, isVideoPage, incoming, user?.role]);

  useEffect(() => {
    if (!incoming) return;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      void expireIncomingCall(incoming.roomId);
    }, RINGING_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };
  }, [incoming?.roomId]);

  useEffect(() => {
    if (!incoming) {
      stopRingtone();
      return;
    }
    startRingtone();
    return () => stopRingtone();
  }, [incoming?.roomId]);

  async function acceptCall() {
    if (!incoming) return;
    const roomId = incoming.roomId;
    ignoredRoomIdsRef.current.add(roomId);
    stopRingtone();
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    setIncoming(null);
    await api.patch("/video-calls", { roomId, status: "active" }).catch(() => null);
    await broadcastRealtime(`video-call-${roomId}`, "call-accepted", { roomId, userId });
    router.push(`/video-call/${roomId}?accept=1`);
  }

  async function declineCall() {
    if (!incoming) return;
    const roomId = incoming.roomId;
    ignoredRoomIdsRef.current.add(roomId);
    stopRingtone();
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    setIncoming(null);
    await api.patch("/video-calls", { roomId, status: "declined" }).catch(() => null);
    await broadcastRealtime(`video-call-${roomId}`, "call-declined", { roomId, userId });
  }

  async function expireIncomingCall(roomId: string) {
    try {
      const response = await api.get(`/video-calls/${roomId}`);
      const currentStatus = response.data.data?.status;
      if (currentStatus === "active" || currentStatus === "ended" || currentStatus === "declined") {
        ignoredRoomIdsRef.current.add(roomId);
        setIncoming((current) => current?.roomId === roomId ? null : current);
        stopRingtone();
        return;
      }
      await api.patch("/video-calls", { roomId, status: "ended" }).catch(() => null);
    } catch {
      await api.patch("/video-calls", { roomId, status: "ended" }).catch(() => null);
    }
    ignoredRoomIdsRef.current.add(roomId);
    setIncoming((current) => current?.roomId === roomId ? null : current);
    stopRingtone();
  }

  function startRingtone() {
    try {
      const AudioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor || oscillatorRef.current) return;
      const context = audioRef.current || new AudioCtor();
      audioRef.current = context;
      if (context.state === "suspended") void context.resume().catch(() => null);
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.value = 0.04;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillatorRef.current = oscillator;
      gainRef.current = gain;
      activeRingtones.add({ oscillator, gain, context });
    } catch {
      // Browser may block audio before user interaction; popup remains visible.
    }
  }

  function stopRingtone() {
    stopAllRingtones();
    oscillatorRef.current = null;
    gainRef.current = null;
    audioRef.current = null;
  }

  if (!incoming) return null;

  return (
    <div className="fixed inset-0 z-[160] grid place-items-center bg-slate-900/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-center shadow-[0_24px_80px_rgba(14,116,144,0.25)]">
        <button type="button" className="ml-auto grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100" onClick={declineCall} aria-label="Close incoming call">
          <X size={17} />
        </button>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-cyanSoft text-medical">
          <Video size={28} />
        </div>
        <h2 className="mt-4 text-xl font-extrabold text-navy">Видео дуудлага ирлээ</h2>
        <p className="mt-2 text-sm font-semibold text-slate-600">{callerName}</p>
        <div className="mt-5 flex justify-center gap-3">
          <button type="button" className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700" onClick={acceptCall}>
            <Video size={16} /> Accept
          </button>
          <button type="button" className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-3 text-sm font-bold text-white hover:bg-rose-700" onClick={declineCall}>
            <PhoneOff size={16} /> Decline
          </button>
        </div>
      </div>
    </div>
  );
}

function stopAllRingtones() {
  for (const node of Array.from(activeRingtones)) {
    try {
      node.gain.gain.value = 0;
      node.oscillator.stop();
    } catch {
      // Already stopped.
    }
    try {
      node.oscillator.disconnect();
      node.gain.disconnect();
    } catch {
      // Already disconnected.
    }
    if (node.context.state !== "closed") void node.context.close().catch(() => null);
    activeRingtones.delete(node);
  }
}
