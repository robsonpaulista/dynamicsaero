import type { Metadata } from "next";
import { AporteForm } from "@/components/formularios/aporte-form";

export const metadata: Metadata = { title: "Editar aporte" };

export default async function EditarAportePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AporteForm id={id} />;
}
