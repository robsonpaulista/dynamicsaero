"use client";

import Link from "next/link";
import { BotaoNovo, LinkEditar } from "@/components/formularios/campos";
import { PageStack } from "@/components/ui/tse";
import { useDados } from "@/hooks/use-dados";
import { CATEGORY_LABEL } from "@/lib/labels";
import { listContasPlano } from "@/services/operacao";

export function PlanoContasView() {
  useDados();
  const contas = listContasPlano();
  const fixas = contas.filter((item) => item.grupo === "fixa");
  const variaveis = contas.filter((item) => item.grupo === "variavel");

  return (
    <PageStack>
      <Link
        href="/despesas"
        className="text-[12px] font-bold tracking-wide text-tse-olive uppercase hover:underline"
      >
        Voltar às despesas
      </Link>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight">Plano de contas</h2>
            <p className="mt-1 text-[13px] text-tse-muted">
              Cadastro usado na despesa avulsa. Cada conta já nasce como fixa ou variável.
            </p>
          </div>
          <BotaoNovo href="/despesas/contas/nova">Nova conta</BotaoNovo>
        </div>
      </section>

      <GrupoContas titulo="Despesas fixas" itens={fixas} />
      <GrupoContas titulo="Despesas variáveis" itens={variaveis} />
    </PageStack>
  );
}

function GrupoContas({
  titulo,
  itens,
}: {
  titulo: string;
  itens: ReturnType<typeof listContasPlano>;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h3 className="text-[15px] font-bold">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="mt-3 text-[13px] text-tse-muted">Nenhuma conta neste grupo.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#EEEEEE]">
          {itens.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
              <div className="min-w-0">
                <p className="font-semibold">
                  {item.nome}
                  {!item.ativo ? (
                    <span className="ml-2 text-[11px] font-bold tracking-wide text-tse-muted uppercase">
                      Inativa
                    </span>
                  ) : null}
                </p>
                <p className="text-tse-muted">{CATEGORY_LABEL[item.category]}</p>
              </div>
              <LinkEditar href={`/despesas/contas/${item.id}/editar`} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
