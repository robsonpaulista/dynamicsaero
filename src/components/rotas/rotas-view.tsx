"use client";

import { BotaoNovo, LinkEditar } from "@/components/formularios/campos";
import { PageStack } from "@/components/ui/tse";
import { useDados } from "@/hooks/use-dados";

export function RotasView() {
  const base = useDados();
  const rotas = [...base.rotas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <PageStack>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight">Rotas da operação</h2>
            <p className="mt-1 max-w-xl text-[13px] text-tse-muted">
              Origem, destino e horas de bloco dos trechos que se repetem. No itinerário, a perna pode nascer de uma rota.
            </p>
          </div>
          <BotaoNovo href="/rotas/nova">Nova rota</BotaoNovo>
        </div>

        {rotas.length === 0 ? (
          <p className="mt-6 text-[13px] text-tse-muted">Nenhuma rota cadastrada.</p>
        ) : (
          <ul className="mt-5 divide-y divide-tse-line">
            {rotas.map((rota) => (
              <li key={rota.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{rota.nome}</span>
                  <span className="block truncate text-[13px] text-tse-muted">
                    {rota.fromIcao} {rota.fromCity} → {rota.toIcao} {rota.toCity}
                    {rota.blockHours > 0 ? ` · ${String(rota.blockHours).replace(".", ",")} h` : ""}
                  </span>
                  {rota.note ? (
                    <span className="mt-1 block truncate text-[12px] text-tse-muted">{rota.note}</span>
                  ) : null}
                </span>
                <LinkEditar href={`/rotas/${rota.id}/editar`} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageStack>
  );
}
