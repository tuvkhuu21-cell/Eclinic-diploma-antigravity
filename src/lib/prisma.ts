import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
let connectionInfoLogged = false;

function getRuntimeDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return undefined;

  try {
    const parsed = new URL(databaseUrl);
    if (parsed.hostname.includes("pooler.supabase.com")) {
      parsed.port = "6543";
      parsed.searchParams.set("pgbouncer", "true");
      parsed.searchParams.set("connection_limit", "1");
      if (!parsed.searchParams.has("pool_timeout")) parsed.searchParams.set("pool_timeout", "20");
    }
    return parsed.toString();
  } catch {
    return databaseUrl;
  }
}

function logDatabaseConnectionInfo() {
  if (connectionInfoLogged || process.env.NODE_ENV === "production") return;
  connectionInfoLogged = true;
  const databaseUrl = getRuntimeDatabaseUrl();
  if (!databaseUrl) {
    console.info("Prisma database connection: DATABASE_URL is missing");
    return;
  }
  try {
    const parsed = new URL(databaseUrl);
    console.info("Prisma database connection", {
      host: parsed.hostname,
      port: parsed.port || "5432",
      database: parsed.pathname.replace(/^\//, ""),
      schema: parsed.searchParams.get("schema") || "public",
      pgbouncer: parsed.searchParams.get("pgbouncer") === "true",
      connectionLimit: parsed.searchParams.get("connection_limit") || undefined,
    });
  } catch {
    console.info("Prisma database connection: DATABASE_URL is not a valid URL");
  }
}

logDatabaseConnectionInfo();

const runtimeDatabaseUrl = getRuntimeDatabaseUrl();

export const prisma = globalForPrisma.prisma ?? new PrismaClient(
  runtimeDatabaseUrl ? { datasources: { db: { url: runtimeDatabaseUrl } } } : undefined,
);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
