import type { Metadata } from "next";
import { DespesaForm } from "@/components/formularios/despesa-form";

export const metadata: Metadata = { title: "Nova despesa" };

export default function NovaDespesaPage() {
  return <DespesaForm />;
}
