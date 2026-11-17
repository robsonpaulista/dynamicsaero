import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ehErroRedeSupabase } from "@/services/supabase-servidor";
import { sessaoAtual, usuarioDaRequisicao } from "@/services/usuarios";

export const dynamic = "force-dynamic";

export default async function CockpitLayout({ children }: { children: ReactNode }) {
  const userId = await usuarioDaRequisicao();
  if (!userId) redirect("/entrar");
  let sessao;
  try {
    sessao = await sessaoAtual();
  } catch (erro: unknown) {
    if (ehErroRedeSupabase(erro)) redirect("/entrar?aviso=rede");
    throw erro;
  }
  if (!sessao) redirect("/sair");
  return <AppShell sessao={sessao}>{children}</AppShell>;
}
