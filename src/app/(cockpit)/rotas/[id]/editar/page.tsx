import type { Metadata } from "next";
import { RotaForm } from "@/components/rotas/rota-form";

export const metadata: Metadata = { title: "Editar rota" };

export default async function EditarRotaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RotaForm id={id} />;
}
