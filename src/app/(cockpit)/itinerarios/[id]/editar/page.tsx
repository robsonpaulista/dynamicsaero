import type { Metadata } from "next";
import { ItinerarioForm } from "@/components/formularios/itinerario-form";

export const metadata: Metadata = { title: "Editar voo" };

export default async function EditarItinerarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ItinerarioForm id={id} />;
}
