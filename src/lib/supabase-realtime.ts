import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let missingEnvLogged = false;
const missingEnvMessage = "Supabase environment variables are missing";
const broadcastChannels = new Map<string, { channel: RealtimeChannel; ready: Promise<void> }>();

function getBrowserSupabaseEnv() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL;
  return {
    url: normalizeSupabaseUrl(rawUrl),
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_KEY,
  };
}

function normalizeSupabaseUrl(url?: string) {
  return url?.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

function logMissingSupabaseEnv() {
  if (missingEnvLogged) return;
  missingEnvLogged = true;
  if (process.env.NODE_ENV !== "production") console.warn(missingEnvMessage);
}

export function isSupabaseRealtimeEnabled() {
  const { url, publishableKey } = getBrowserSupabaseEnv();
  return Boolean(url && publishableKey);
}

export function getSupabaseBrowserClient() {
  const { url, publishableKey } = getBrowserSupabaseEnv();
  if (!url || !publishableKey) {
    logMissingSupabaseEnv();
    return null;
  }
  if (!browserClient) {
    browserClient = createClient(
      url,
      publishableKey,
      { realtime: { params: { eventsPerSecond: 20 } } },
    );
  }
  return browserClient;
}

export async function broadcastRealtime(channelName: string, event: string, payload: unknown) {
  const entry = getBroadcastChannel(channelName);
  if (!entry) return;
  await entry.ready;
  await entry.channel.send({ type: "broadcast", event, payload });
}

export function subscribeBroadcast<T>(
  channelName: string,
  event: string,
  handler: (payload: T) => void,
): RealtimeChannel | null {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const channel = client.channel(channelName, { config: { broadcast: { self: false } } });
  channel.on("broadcast", { event }, ({ payload }) => handler(payload as T)).subscribe();
  return channel;
}

export function removeRealtimeChannel(channel: RealtimeChannel | null) {
  const client = getSupabaseBrowserClient();
  if (client && channel) void client.removeChannel(channel);
}

export function trackUserPresence(userId: string, payload: Record<string, unknown> = {}) {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const channel = client.channel(`user-presence-${userId}`, {
    config: { presence: { key: userId } },
  });
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      void channel.track({ userId, onlineAt: new Date().toISOString(), ...payload });
    }
  });
  return channel;
}

export function subscribeUserPresence(userId: string, onChange: (online: boolean) => void) {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const channel = client.channel(`user-presence-${userId}`, {
    config: { presence: { key: userId } },
  });
  const emitState = () => {
    const state = channel.presenceState();
    onChange(Object.values(state).some((entries) => entries.length > 0));
  };
  channel
    .on("presence", { event: "sync" }, emitState)
    .on("presence", { event: "join" }, () => onChange(true))
    .on("presence", { event: "leave" }, emitState)
    .subscribe();
  return channel;
}

function getBroadcastChannel(channelName: string) {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const existing = broadcastChannels.get(channelName);
  if (existing) return existing;

  const channel = client.channel(channelName, { config: { broadcast: { self: false } } });
  const ready = new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 800);
    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      window.clearTimeout(timeout);
      resolve();
    });
  });
  const entry = { channel, ready };
  broadcastChannels.set(channelName, entry);
  return entry;
}
