import type { Metadata } from "next";
import { AeronaveForm } from "@/components/formularios/aeronave-form";

export const metadata: Metadata = { title: "Editar aeronave" };

export default async function EditarAeronavePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AeronaveForm id={id} />;
}
