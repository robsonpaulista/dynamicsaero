import type { Metadata } from "next";
import { PessoalForm } from "@/components/formularios/pessoal-form";

export const metadata: Metadata = { title: "Nova pessoa" };

export default function NovaPessoaPage() {
  return <PessoalForm />;
}
