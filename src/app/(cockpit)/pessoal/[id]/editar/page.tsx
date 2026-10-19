import type { Metadata } from "next";
import { PessoalForm } from "@/components/formularios/pessoal-form";

export const metadata: Metadata = { title: "Editar pessoa" };

export default async function EditarPessoaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PessoalForm id={id} />;
}
