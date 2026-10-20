import type { Metadata } from "next";
import { RotaForm } from "@/components/rotas/rota-form";

export const metadata: Metadata = { title: "Nova rota" };

export default function NovaRotaPage() {
  return <RotaForm />;
}
