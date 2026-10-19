import type { Metadata } from "next";
import { ManutencaoForm } from "@/components/formularios/manutencao-form";

export const metadata: Metadata = { title: "Nova manutenção" };

export default function NovaManutencaoPage() {
  return <ManutencaoForm />;
}
