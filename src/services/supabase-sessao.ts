import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { COOKIE_LEMBRAR, opcoesConformeLembranca } from "@/lib/lembrar-cookie";

export async function criarClienteSessao(lembrar?: boolean) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) {
    throw new Error("Faltam a URL ou a chave anônima do Supabase.");
  }

  const jar = await cookies();
  if (lembrar === true) {
    jar.set(COOKIE_LEMBRAR, "1", {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: 400 * 24 * 60 * 60,
    });
  } else if (lembrar === false) {
    jar.set(COOKIE_LEMBRAR, "0", { path: "/", sameSite: "lax", httpOnly: false });
  }

  return createServerClient(url, chave, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(lista) {
        try {
          lista.forEach(({ name, value, options }) => {
            const gravar = lembrar === undefined ? options : opcoesConformeLembranca(options, lembrar);
            jar.set(name, value, gravar);
          });
        } catch {
          // Em páginas o Next não deixa gravar cookie. O proxy renova a sessão.
        }
      },
    },
  });
}
