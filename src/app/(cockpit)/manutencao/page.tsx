import type { Metadata } from "next";
import { ManutencaoView } from "@/components/manutencao/manutencao-view";

export const metadata: Metadata = { title: "Manutenção" };

export default function ManutencaoPage() {
  return <ManutencaoView />;
}
