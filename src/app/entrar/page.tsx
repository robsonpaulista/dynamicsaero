import type { Metadata } from "next";
import { EntradaView } from "@/components/entrar/entrada-view";
import { operacaoSemAcesso } from "@/services/usuarios";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage() {
  let primeiroAcesso = false;
  let avisoInicial = "";
  try {
    primeiroAcesso = await operacaoSemAcesso();
  } catch {
    avisoInicial = "Não foi possível consultar os acessos da operação.";
  }

  return <EntradaView primeiroAcesso={primeiroAcesso} avisoInicial={avisoInicial} />;
}
