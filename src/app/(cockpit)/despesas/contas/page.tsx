import type { Metadata } from "next";
import { PlanoContasView } from "@/components/despesas/plano-contas-view";

export const metadata: Metadata = { title: "Plano de contas" };

export default function ContasPage() {
  return <PlanoContasView />;
}
