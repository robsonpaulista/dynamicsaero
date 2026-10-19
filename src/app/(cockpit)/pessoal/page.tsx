import type { Metadata } from "next";
import { PessoalView } from "@/components/pessoal/pessoal-view";

export const metadata: Metadata = { title: "Pessoal" };

export default function PessoalPage() {
  return <PessoalView />;
}
