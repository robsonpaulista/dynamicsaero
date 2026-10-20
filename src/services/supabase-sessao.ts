import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { COOKIE_LEMBRAR, cookieSeguro, opcoesConformeLembranca } from "@/lib/lembrar-cookie";

async function requisicaoHttps(): Promise<boolean> {
  const cabecalhos = await headers();
  const proto = cabecalhos.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return proto === "https";
}

export async function criarClienteSessao(lembrar?: boolean) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) {
    throw new Error("Faltam a URL ou a chave anônima do Supabase.");
  }

  const jar = await cookies();
  const seguro = cookieSeguro(await requisicaoHttps());
  if (lembrar === true) {
    jar.set(COOKIE_LEMBRAR, "1", {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      secure: seguro,
      maxAge: 400 * 24 * 60 * 60,
    });
  } else if (lembrar === false) {
    jar.set(COOKIE_LEMBRAR, "0", { path: "/", sameSite: "lax", httpOnly: false, secure: seguro });
  }

  return createServerClient(url, chave, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: seguro,
    },
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
        } catch (erro) {
          const mensagem = erro instanceof Error ? erro.message : "";
          if (!mensagem.includes("Cookies can only be modified")) throw erro;
        }
      },
    },
  });
}
