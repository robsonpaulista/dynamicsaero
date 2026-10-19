"use client";

import Link from "next/link";
import { useState } from "react";
import { BotaoNovo } from "@/components/formularios/campos";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import { PageStack, StatusBadge } from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { formatBRL } from "@/lib/format";
import { KIND_LABEL } from "@/lib/labels";
import { getAircraft, listMaintenance, matchesAircraft } from "@/services/operacao";
import type { MaintenanceItem, MxKind, MxStatus } from "@/types/operacao";

type Aba = "todas" | MxKind;

const COLUNAS: { id: MxStatus; title: string; hint: string }[] = [
  { id: "em_execucao", title: "Em execução", hint: "Oficina trabalhando agora" },
  { id: "proxima", title: "Próximas", hint: "Janela aberta ou quase" },
  { id: "em_dia", title: "Em dia", hint: "Só acompanhar" },
  { id: "concluida", title: "Concluídas", hint: "Já saíram da agenda" },
];

export function ManutencaoView() {
  useDados();
  const { aircraftId } = useOperacao();
  const [aba, setAba] = useState<Aba>("todas");
  const items = listMaintenance().filter(
    (item) =>
      matchesAircraft(item.aircraftId, aircraftId) &&
      (aba === "todas" || item.kind === aba),
  );

  return (
    <PageStack>
      <FiltrosOperacao legenda="Preventiva no calendário. Corretiva quando algo quebra." />
      <div className="flex justify-end">
        <BotaoNovo href="/manutencao/nova">Nova manutenção</BotaoNovo>
      </div>
      <div className="flex flex-wrap gap-5 border-b border-tse-border text-[12px] font-bold tracking-wide uppercase">
        {(
          [
            ["todas", "Visão"],
            ["preventiva", "Preventiva"],
            ["corretiva", "Corretiva"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={aba === id}
            onClick={() => setAba(id)}
            className={`-mb-px border-b-2 pb-2 ${
              aba === id ? "border-tse-yellow text-tse-gold" : "border-transparent text-tse-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-4">
        {COLUNAS.map((coluna) => {
          const cards = items.filter((item) => item.status === coluna.id);
          return (
            <section key={coluna.id} className="rounded-2xl bg-white p-3 shadow-sm">
              <h2 className="px-1 text-[14px] font-bold">{coluna.title}</h2>
              <p className="px-1 text-[12px] text-tse-muted">
                {coluna.hint} · {cards.length}
              </p>
              <ul className="mt-3 space-y-2">
                {cards.length === 0 ? (
                  <li className="rounded-xl bg-tse-bg px-3 py-6 text-center text-[12px] text-tse-muted">
                    Nada aqui
                  </li>
                ) : (
                  cards.map((item) => <Ordem key={item.id} item={item} />)
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </PageStack>
  );
}

function Ordem({ item }: { item: MaintenanceItem }) {
  const craft = getAircraft(item.aircraftId);
  const valor = item.cost > 0 ? item.cost : item.estimate;
  return (
    <li>
      <Link
        href={`/manutencao/${item.id}`}
        className="block rounded-xl bg-tse-bg px-3 py-3 hover:bg-tse-soft"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-bold">{craft?.registration}</span>
          <StatusBadge value={item.kind} />
        </div>
        <p className="mt-1 text-[14px] font-bold leading-5">{item.title}</p>
        <p className="mt-1 text-[12px] text-tse-muted">{item.dueLabel}</p>
        <p className="mt-2 text-[12px] font-semibold">
          {KIND_LABEL[item.kind]}
          {valor ? ` · ${formatBRL(valor)}` : ""}
          {item.grounding ? " · retém a aeronave" : ""}
        </p>
      </Link>
    </li>
  );
}
