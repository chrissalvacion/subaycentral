import { createBrowserClient } from "@supabase/ssr";

let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

const fallbackUrl = "https://placeholder.supabase.co";
const fallbackAnonKey = "placeholder-anon-key";

export function createClient() {
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
