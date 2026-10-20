import type { Metadata } from "next";
import { RotasView } from "@/components/rotas/rotas-view";

export const metadata: Metadata = { title: "Rotas" };

export default function RotasPage() {
  return <RotasView />;
}
