import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Despesas fixas" };

/** Hangar deixou de ser página própria — vira despesa fixa em Despesas. */
export default function HangarPage() {
  redirect("/despesas?recorte=fixas");
}
