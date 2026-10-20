import { createBrowserClient } from "@supabase/ssr";

export function clienteNavegador() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) {
    throw new Error("Faltam a URL ou a chave anônima do Supabase.");
  }
  return createBrowserClient(url, chave, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: window.location.protocol === "https:",
    },
  });
}
