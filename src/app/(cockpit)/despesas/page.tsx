import type { Metadata } from "next";
import { DespesasView } from "@/components/despesas/despesas-view";

export const metadata: Metadata = { title: "Despesas" };

export default function DespesasPage() {
  return <DespesasView />;
}
