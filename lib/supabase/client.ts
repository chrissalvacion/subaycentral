import { createBrowserClient } from "@supabase/ssr";
import { createDevClient } from "@/lib/dev-client";

let clientInstance: ReturnType<typeof createBrowserClient> | null = null;
let devClientInstance: ReturnType<typeof createDevClient> | null = null;

const fallbackUrl = "https://placeholder.supabase.co";
const fallbackAnonKey = "placeholder-anon-key";

function isSqliteDevMode() {
  return process.env.NEXT_PUBLIC_DEV_DB === "sqlite";
}

export function createClient() {
  if (isSqliteDevMode()) {
    if (!devClientInstance) {
      devClientInstance = createDevClient();
    }
    return devClientInstance as unknown as ReturnType<typeof createBrowserClient>;
  }

  if (!clientInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fallbackUrl;
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fallbackAnonKey;

    clientInstance = createBrowserClient(
      url,
      anonKey
    );
  }

  return clientInstance;
}
