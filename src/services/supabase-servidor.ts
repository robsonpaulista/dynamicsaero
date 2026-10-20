import { createClient } from "@supabase/supabase-js";

export function clienteServico() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    throw new Error("Faltam a URL do Supabase ou a chave de serviço.");
  }
  return createClient(url, chave, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
