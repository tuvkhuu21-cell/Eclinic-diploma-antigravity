import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let missingEnvLogged = false;
const missingEnvMessage = "Supabase environment variables are missing";

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
  const client = getSupabaseBrowserClient();
  if (!client) return;
  const channel = client.channel(channelName, { config: { broadcast: { self: false } } });
  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 1200);
    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      window.clearTimeout(timeout);
      void channel.send({ type: "broadcast", event, payload }).finally(resolve);
    });
  });
  window.setTimeout(() => {
    void client.removeChannel(channel);
  }, 1000);
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
