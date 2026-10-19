import type { Metadata } from "next";
import { ManutencaoForm } from "@/components/formularios/manutencao-form";

export const metadata: Metadata = { title: "Editar manutenção" };

export default async function EditarManutencaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ManutencaoForm id={id} />;
}
