import type { Metadata } from "next";
import { ContaForm } from "@/components/formularios/conta-form";

export const metadata: Metadata = { title: "Nova conta" };

export default function NovaContaPage() {
  return <ContaForm />;
}
