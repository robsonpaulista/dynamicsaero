"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CircleDollarSign,
  Plus,
  Search,
  Wrench,
} from "lucide-react";
import { BotaoNovo } from "@/components/formularios/campos";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import { PageStack, StatusBadge } from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { cn, formatBRL } from "@/lib/format";
import { KIND_LABEL } from "@/lib/labels";
import {
  getAircraft,
  listMaintenance,
  matchesAircraft,
  monthsLabel,
} from "@/services/operacao";
import type { MaintenanceItem, MxKind, MxStatus } from "@/types/operacao";

type Aba = "todas" | MxKind;

const COLUNAS: { id: MxStatus; title: string; hint: string }[] = [
  { id: "em_execucao", title: "Em execução", hint: "Oficina trabalhando agora" },
  { id: "proxima", title: "Próximas", hint: "Janela aberta ou quase" },
  { id: "em_dia", title: "Em dia", hint: "Só acompanhar" },
  { id: "concluida", title: "Concluídas", hint: "Já saíram da agenda" },
];

const ABAS: { id: Aba; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "preventiva", label: "Preventiva" },
  { id: "corretiva", label: "Corretiva" },
];

export function ManutencaoView() {
  useDados();
  const { aircraftId, months, partnerId } = useOperacao();
  const [aba, setAba] = useState<Aba>("todas");
  const [query, setQuery] = useState<string>("");

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return listMaintenance()
      .filter((item) => matchesAircraft(item.aircraftId, aircraftId))
      .filter((item) => {
        if (!partnerId) return true;
        const craft = getAircraft(item.aircraftId);
        return craft?.ownership.some((owner) => owner.partnerId === partnerId) ?? false;
      })
      .filter((item) => aba === "todas" || item.kind === aba)
      .filter((item) => {
        if (!needle) return true;
        const craft = getAircraft(item.aircraftId);
        const blob = [item.title, item.dueLabel, craft?.registration, KIND_LABEL[item.kind]]
          .join(" ")
          .toLowerCase();
        return blob.includes(needle);
      });
  }, [aircraftId, partnerId, aba, query]);

  const emExecucao = items.filter((item) => item.status === "em_execucao").length;
  const custoAberto = items
    .filter((item) => item.status !== "concluida")
    .reduce((soma, item) => soma + (item.cost > 0 ? item.cost : (item.estimate ?? 0)), 0);
  const contextoPeriodo = [
    aircraftId === "todas"
      ? "Toda a operação"
      : (getAircraft(aircraftId)?.registration ?? aircraftId),
    monthsLabel(months),
  ].join(" · ");

  return (
    <PageStack>
      {partnerId ? (
        <div className="flex items-start gap-3">
          <Link
            href="/painel"
            className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-tse-text shadow-sm"
            aria-label="Voltar ao painel"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight">Manutenção</h1>
            <p className="mt-0.5 text-[13px] text-tse-muted">{contextoPeriodo}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight">Manutenção</h1>
            <p className="mt-0.5 text-[13px] text-tse-muted">{contextoPeriodo}</p>
          </div>
          <Link
            href="/manutencao/nova"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-tse-text text-white shadow-sm md:hidden"
            aria-label="Nova manutenção"
          >
            <Plus className="size-5" aria-hidden />
          </Link>
        </div>
      )}

      <FiltrosOperacao
        compacto={Boolean(partnerId)}
        legenda={partnerId ? undefined : "Preventiva no calendário. Corretiva quando algo quebra."}
      />

      {!partnerId ? (
        <div className="hidden justify-end md:flex">
          <BotaoNovo href="/manutencao/nova">Nova manutenção</BotaoNovo>
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">Resumo</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MetricaIcone icone={Wrench} label="Ordens" value={String(items.length)} />
          <MetricaIcone icone={Wrench} label="Em execução" value={String(emExecucao)} />
          <MetricaIcone
            icone={CircleDollarSign}
            label="Em aberto"
            value={formatBRL(Math.round(custoAberto))}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm">
        <label className="relative block">
          <span className="sr-only">Buscar manutenção</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tse-muted"
            aria-hidden
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título, aeronave ou prazo"
            className="h-11 w-full rounded-xl border border-tse-line bg-tse-bg/40 pr-3 pl-10 text-[14px] outline-none focus:border-tse-olive"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2 pb-1">
          {ABAS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={aba === item.id}
              onClick={() => setAba(item.id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] font-bold",
                aba === item.id
                  ? "bg-tse-text text-white"
                  : "border border-[#EEF0F3] bg-white text-tse-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-4">
        {COLUNAS.map((coluna) => {
          const cards = items.filter((item) => item.status === coluna.id);
          return (
            <section
              key={coluna.id}
              className="rounded-2xl border border-[#EEF0F3] bg-white p-3 shadow-sm"
            >
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

function MetricaIcone({
  icone: Icone,
  label,
  value,
}: {
  icone: typeof Wrench;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[11px] text-tse-muted">
        <Icone className="size-3.5 shrink-0 text-tse-olive" aria-hidden />
        {label}
      </p>
      <p className="mt-1 truncate text-[18px] font-bold tracking-tight tabular-nums sm:text-[20px]">
        {value}
      </p>
    </div>
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
        <p className="mt-2 text-[12px] font-semibold tabular-nums">
          {KIND_LABEL[item.kind]}
          {valor ? ` · ${formatBRL(valor)}` : ""}
          {item.grounding ? " · retém a aeronave" : ""}
        </p>
      </Link>
    </li>
  );
}
