import type { Metadata } from "next";
import { AporteForm } from "@/components/formularios/aporte-form";

export const metadata: Metadata = { title: "Novo aporte" };

export default function NovoAportePage() {
  return <AporteForm />;
}
