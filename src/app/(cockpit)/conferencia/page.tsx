import type { Metadata } from "next";
import { ConferenciaView } from "@/components/conferencia/conferencia-view";

export const metadata: Metadata = { title: "Prestação de contas" };

export default function ConferenciaPage() {
  return <ConferenciaView />;
}
