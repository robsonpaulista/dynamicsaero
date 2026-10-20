"use server";

import type { BaseDados } from "@/services/dados";
import { clienteServico } from "@/services/supabase-servidor";

function carga(base: BaseDados): Record<string, unknown> {
  const serializado: unknown = JSON.parse(JSON.stringify(base));
  if (typeof serializado !== "object" || serializado === null || Array.isArray(serializado)) {
    throw new Error("Não foi possível preparar os dados da operação.");
  }
  const registro: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(serializado)) {
    registro[chave] = valor;
  }
  return registro;
}

export async function carregarOperacao(): Promise<unknown> {
  const supabase = clienteServico();
  const { data, error } = await supabase.rpc("ler_operacao_aero");
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function gravarOperacao(base: BaseDados): Promise<void> {
  const supabase = clienteServico();
  const { error } = await supabase.rpc("gravar_operacao_aero", { payload: carga(base) });
  if (error) {
    throw new Error(error.message);
  }
}
