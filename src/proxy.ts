import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_LEMBRAR, opcoesConformeLembranca } from "@/lib/lembrar-cookie";

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

  const { data } = await supabase.auth.getUser();
  const caminho = request.nextUrl.pathname;

  if (caminho === "/sair" || caminho === "/acesso") return response;

  if (!data.user && caminho !== "/entrar") {
    return redirecionar(request, response, "/entrar");
  }

  if (data.user && caminho === "/entrar") {
    return redirecionar(request, response, "/painel");
  }

  return response;
}

function redirecionar(request: NextRequest, response: NextResponse, caminho: string) {
  const destino = request.nextUrl.clone();
  destino.pathname = caminho;
  destino.search = "";
  const redirect = NextResponse.redirect(destino);
  response.headers.getSetCookie().forEach((cookie) => {
    redirect.headers.append("set-cookie", cookie);
  });
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
