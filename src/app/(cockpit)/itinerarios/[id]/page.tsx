import type { Metadata } from "next";
import { ItinerarioDetalhe } from "@/components/itinerarios/itinerario-detalhe";

export const metadata: Metadata = { title: "Itinerário" };

export default function ItinerarioPage() {
  return <ItinerarioDetalhe />;
}
