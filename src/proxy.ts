import { NextResponse, type NextRequest } from "next/server";
import { CABECALHO_USUARIO, chaveAuth, lerSessaoCookie, usuarioComTokenValido } from "@/lib/sessao-cookie";

function seguirComUsuario(request: NextRequest, userId: string) {
  const headers = new Headers(request.headers);
  headers.delete(CABECALHO_USUARIO);
  headers.set(CABECALHO_USUARIO, userId);
  return NextResponse.next({ request: { headers } });
}

export async function proxy(request: NextRequest) {
  const caminho = request.nextUrl.pathname;
  if (caminho === "/sair" || caminho === "/acesso") return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return NextResponse.next();

  const sessao = lerSessaoCookie(request.cookies.getAll(), chaveAuth(url));
  const userId = sessao ? usuarioComTokenValido(sessao.access_token) : null;

  if (!userId && caminho !== "/entrar") {
    return redirecionar(request, "/entrar");
  }

  if (userId && caminho === "/entrar") {
    return redirecionar(request, "/painel");
  }

  if (!userId) return NextResponse.next();
  return seguirComUsuario(request, userId);
}

function redirecionar(request: NextRequest, caminho: string) {
  const destino = request.nextUrl.clone();
  destino.pathname = caminho;
  destino.search = "";
  const redirect = NextResponse.redirect(destino);
  redirect.headers.set("Cache-Control", "no-store");
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
