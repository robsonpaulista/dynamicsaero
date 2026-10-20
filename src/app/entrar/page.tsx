import type { Metadata } from "next";
import { EntradaView } from "@/components/entrar/entrada-view";
import { avisoEntrada } from "@/lib/aviso-entrada";
import { operacaoSemAcesso } from "@/services/usuarios";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const params = await searchParams;
  let primeiroAcesso = false;
  let avisoInicial = avisoEntrada(params.aviso);
  try {
    primeiroAcesso = await operacaoSemAcesso();
  } catch {
    if (!avisoInicial) avisoInicial = "Não foi possível consultar os acessos da operação.";
  }

  return <EntradaView primeiroAcesso={primeiroAcesso} avisoInicial={avisoInicial} />;
}
