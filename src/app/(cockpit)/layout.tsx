import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { sessaoAtual } from "@/services/usuarios";

export default async function CockpitLayout({ children }: { children: ReactNode }) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/sair");
  return <AppShell sessao={sessao}>{children}</AppShell>;
}
