import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serverClient: SupabaseClient | null = null;
let missingEnvLogged = false;
const missingEnvMessage = "Supabase environment variables are missing";

function getServerSupabaseEnv() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL
    || process.env.SUPABASE_URL;
  return {
    url: normalizeSupabaseUrl(rawUrl),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.SUPABASE_SECRET_KEY
      || process.env.SUPABASE_SERVICE_KEY,
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

function getServerClient() {
  const { url, serviceKey } = getServerSupabaseEnv();
  if (!url || !serviceKey) return null;
  if (!serverClient) {
    serverClient = createClient(
      url,
      serviceKey,
      { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 20 } } },
    );
  }
  return serverClient;
}

export function isSupabaseRealtimeServerEnabled() {
  const { url, serviceKey } = getServerSupabaseEnv();
  return Boolean(url && serviceKey);
}

export async function broadcastRealtimeServer(channelName: string, event: string, payload: unknown) {
  const client = getServerClient();
  if (!client) {
    logMissingSupabaseEnv();
    return;
  }
  const channel = client.channel(channelName, { config: { broadcast: { self: false } } });
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 400);
    void channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      clearTimeout(timeout);
      void channel.send({ type: "broadcast", event, payload }).finally(resolve);
    });
  });
  await client.removeChannel(channel);
}
