import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_LEMBRAR, opcoesConformeLembranca } from "@/lib/lembrar-cookie";
import { CABECALHO_USUARIO, chaveAuth, lerSessaoCookie } from "@/lib/sessao-cookie";
import { renovarSessao } from "@/services/renovar-sessao";

function copiarCookies(origem: NextResponse, destino: NextResponse) {
  origem.headers.getSetCookie().forEach((cookie) => {
    destino.headers.append("set-cookie", cookie);
  });
}

function seguirComUsuario(request: NextRequest, origem: NextResponse, userId: string) {
  const headers = new Headers(request.headers);
  headers.delete(CABECALHO_USUARIO);
  headers.set(CABECALHO_USUARIO, userId);
  const seguinte = NextResponse.next({ request: { headers } });
  copiarCookies(origem, seguinte);
  return seguinte;
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) return NextResponse.next();

  let response = NextResponse.next({ request });
  const https =
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
  const supabase = createServerClient(url, chave, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: https,
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(lista) {
        const lembrar = request.cookies.get(COOKIE_LEMBRAR)?.value !== "0";
        lista.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, opcoesConformeLembranca(options, lembrar));
        });
      },
    },
  });

  const sessao = lerSessaoCookie(request.cookies.getAll(), chaveAuth(url));
  let userId: string | null = null;

  if (sessao && sessao.expires_at * 1000 > Date.now() + 5_000) {
    const checado = await supabase.auth.getUser(sessao.access_token);
    if (!checado.error && checado.data.user) userId = checado.data.user.id;
  }

  if (!userId && sessao) {
    const novo = await renovarSessao(url, chave, sessao.refresh_token);
    if (novo) {
      const gravado = await supabase.auth.setSession({
        access_token: novo.access_token,
        refresh_token: novo.refresh_token,
      });
      if (!gravado.error && gravado.data.user) userId = gravado.data.user.id;
    }
  }

  const caminho = request.nextUrl.pathname;

  if (caminho === "/sair" || caminho === "/acesso") return response;

  if (!userId && caminho !== "/entrar") {
    return redirecionar(request, response, "/entrar");
  }

  if (userId && caminho === "/entrar") {
    return redirecionar(request, response, "/painel");
  }

  if (!userId) return response;
  return seguirComUsuario(request, response, userId);
}

function redirecionar(request: NextRequest, response: NextResponse, caminho: string) {
  const destino = request.nextUrl.clone();
  destino.pathname = caminho;
  destino.search = "";
  const redirect = NextResponse.redirect(destino);
  redirect.headers.set("Cache-Control", "no-store");
  copiarCookies(response, redirect);
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
