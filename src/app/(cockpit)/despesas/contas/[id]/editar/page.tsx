import type { Metadata } from "next";
import { ContaForm } from "@/components/formularios/conta-form";

export const metadata: Metadata = { title: "Editar conta" };

export default async function EditarContaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ContaForm id={id} />;
}
