import type { Metadata } from "next";
import { ManutencaoDetalhe } from "@/components/manutencao/manutencao-detalhe";

export const metadata: Metadata = { title: "Ordem de manutenção" };

export default function ManutencaoDetalhePage() {
  return <ManutencaoDetalhe />;
}
