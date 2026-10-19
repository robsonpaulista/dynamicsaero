import type { Metadata } from "next";
import { DespesaForm } from "@/components/formularios/despesa-form";

export const metadata: Metadata = { title: "Editar despesa" };

export default async function EditarDespesaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DespesaForm id={id} />;
}
