import type { Metadata } from "next";
import { Suspense } from "react";
import { DespesasView } from "@/components/despesas/despesas-view";

export const metadata: Metadata = { title: "Despesas" };

export default function DespesasPage() {
  return (
    <Suspense fallback={null}>
      <DespesasView />
    </Suspense>
  );
}
