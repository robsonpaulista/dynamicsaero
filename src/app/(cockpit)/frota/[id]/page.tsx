import type { Metadata } from "next";
import { AeronaveDetalhe } from "@/components/frota/aeronave-detalhe";

export const metadata: Metadata = { title: "Aeronave" };

export default function AeronavePage() {
  return <AeronaveDetalhe />;
}
