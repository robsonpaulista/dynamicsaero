import type { Metadata } from "next";
import { ItinerarioForm } from "@/components/formularios/itinerario-form";

export const metadata: Metadata = { title: "Novo voo" };

export default function NovoItinerarioPage() {
  return <ItinerarioForm />;
}
