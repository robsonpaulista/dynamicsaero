import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { criarClienteSessao } from "@/services/supabase-sessao";
import { sessaoAtual } from "@/services/usuarios";

export default async function CockpitLayout({ children }: { children: ReactNode }) {
  const sessao = await sessaoAtual();
  if (sessao) return <AppShell sessao={sessao}>{children}</AppShell>;

  const supabase = await criarClienteSessao();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/sair");
  redirect("/entrar");
}
