import type { Metadata } from "next";
import { ItinerariosView } from "@/components/itinerarios/itinerarios-view";

export const metadata: Metadata = { title: "Itinerários" };

export default function ItinerariosPage() {
  return <ItinerariosView />;
}
