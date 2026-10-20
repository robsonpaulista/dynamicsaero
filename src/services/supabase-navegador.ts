import { createBrowserClient } from "@supabase/ssr";

type ClienteNavegador = ReturnType<typeof createBrowserClient>;

let cliente: ClienteNavegador | null = null;

export function clienteNavegador(): ClienteNavegador {
  if (cliente) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) {
    throw new Error("Faltam a URL ou a chave anônima do Supabase.");
  }
  cliente = createBrowserClient(url, chave, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: window.location.protocol === "https:",
    },
  });
  return cliente;
}
