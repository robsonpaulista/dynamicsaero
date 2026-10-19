import type { Metadata } from "next";
import { AgenteView } from "@/components/agente/agente-view";

export const metadata: Metadata = { title: "Agente" };

export default function AgentePage() {
  return <AgenteView />;
}
