import type { Metadata } from "next";
import { FrotaView } from "@/components/frota/frota-view";

export const metadata: Metadata = { title: "Frota" };

export default function FrotaPage() {
  return <FrotaView />;
}
