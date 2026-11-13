import type { Metadata } from "next";
import { PessoalView } from "@/components/pessoal/pessoal-view";

export const metadata: Metadata = { title: "Sócios" };

export default function PessoalPage() {
  return <PessoalView />;
}
