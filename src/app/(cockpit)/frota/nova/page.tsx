import type { Metadata } from "next";
import { AeronaveForm } from "@/components/formularios/aeronave-form";

export const metadata: Metadata = { title: "Nova aeronave" };

export default function NovaAeronavePage() {
  return <AeronaveForm />;
}
