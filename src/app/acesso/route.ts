import { NextResponse, type NextRequest } from "next/server";
import { codigoAviso } from "@/lib/aviso-entrada";
import { criarPrimeiroAcesso, entrar } from "@/services/usuarios";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const nome = String(form.get("nome") ?? "");
  const email = String(form.get("email") ?? "");
  const senha = String(form.get("senha") ?? "");
  const lembrar = form.get("lembrar") === "1";
  const primeiro = form.get("primeiro") === "1";

  const falha = primeiro
    ? await criarPrimeiroAcesso(nome, email, senha, lembrar)
    : await entrar(email, senha, lembrar);

  const destino = new URL(falha ? "/entrar" : "/painel", request.url);
  if (falha) destino.searchParams.set("aviso", codigoAviso(falha));
  return NextResponse.redirect(destino, 303);
}
