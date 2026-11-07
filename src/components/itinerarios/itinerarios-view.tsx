"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Plane,
  Plus,
  Search,
} from "lucide-react";
import { BotaoNovo, LinkEditar } from "@/components/formularios/campos";
import { AcoesRelatorio } from "@/components/relatorios/acoes-relatorio";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import {
  EmptyState,
  PageStack,
  SelectField,
  StatusBadge,
  tableClass,
  TableWrap,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { cn, formatBRL, formatDateLista, formatDateShort, formatHours } from "@/lib/format";
import { PURPOSE_LABEL } from "@/lib/labels";
import {
  expensesOfItinerary,
  getAircraft,
  getKpis,
  itinerariesIn,
  itineraryCities,
  itineraryRoute,
  itinerarySpan,
  monthsLabel,
  partnerShort,
  tripHours,
} from "@/services/operacao";
import { relatorioVoos } from "@/services/relatorios-operacao";
import type { Itinerary, ItineraryStatus, Purpose } from "@/types/operacao";

const FINALIDADES: { id: "todas" | Purpose; label: string }[] = [
  { id: "todas", label: "Todos" },
  { id: "negocios", label: "Negócios" },
  { id: "pessoal", label: "Pessoal" },
];

export function ItinerariosView() {
  useDados();
  const { aircraftId, months, partnerId } = useOperacao();
  const [purpose, setPurpose] = useState<"todas" | Purpose>("todas");
  const [status, setStatus] = useState<string>("todas");
  const [query, setQuery] = useState<string>("");
  const [filtrosAbertos, setFiltrosAbertos] = useState<boolean>(false);

  const needle = query.trim().toLowerCase();
  const trips = itinerariesIn(months, aircraftId)
    .filter((trip) => !partnerId || trip.requestedBy === partnerId)
    .filter((trip) => purpose === "todas" || trip.purpose === purpose)
    .filter((trip) => status === "todas" || trip.status === (status as ItineraryStatus))
    .filter((trip) => {
      if (!needle) return true;
      const blob = [
        trip.title,
        trip.note,
        itineraryCities(trip),
        itineraryRoute(trip),
        PURPOSE_LABEL[trip.purpose],
        ...trip.passengers,
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(needle);
    })
    .sort((left, right) => (right.legs[0]?.date ?? "").localeCompare(left.legs[0]?.date ?? ""));

  const horas = trips.reduce((sum, trip) => {
    const hours = tripHours(trip);
    return sum + hours.voadas + hours.previstas;
  }, 0);
  const kpis = getKpis(months, aircraftId);
  const craftAtiva = aircraftId !== "todas" ? getAircraft(aircraftId) : null;
  const contextoPeriodo = [
    craftAtiva?.registration ?? (aircraftId === "todas" ? "Toda a operação" : aircraftId),
    monthsLabel(months),
  ].join(" · ");
  const titulo = partnerId ? "Meus voos" : "Itinerários";

  return (
    <PageStack>
      {partnerId ? (
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Link
              href="/painel"
              className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-tse-text shadow-sm"
              aria-label="Voltar ao painel"
            >
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold tracking-tight">{titulo}</h1>
              <p className="mt-0.5 text-[13px] text-tse-muted">{contextoPeriodo}</p>
            </div>
          </div>
          <Link
            href="/itinerarios/novo"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-tse-text text-white shadow-sm"
            aria-label="Novo voo"
          >
            <Plus className="size-5" aria-hidden />
          </Link>
        </div>
      ) : null}

      <FiltrosOperacao
        compacto={Boolean(partnerId)}
        legenda={partnerId ? undefined : "Cada linha é uma ida e, quando há, a volta."}
      />

      {!partnerId ? (
        <div className="flex justify-end">
          <BotaoNovo href="/itinerarios/novo">Novo voo</BotaoNovo>
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">
          Resumo do período
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MetricaIcone icone={Plane} label="Voos" value={String(trips.length)} />
          <MetricaIcone icone={Clock3} label="Horas" value={formatHours(horas)} />
          <MetricaIcone
            icone={CircleDollarSign}
            label="Custo/hora"
            value={kpis.custoHora === null ? "—" : formatBRL(Math.round(kpis.custoHora))}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#EEF0F3] bg-white shadow-sm">
        <button
          type="button"
          aria-expanded={filtrosAbertos}
          onClick={() => setFiltrosAbertos((atual) => !atual)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="text-[13px] font-bold">Filtrar voos</span>
          <ChevronDown
            className={cn(
              "size-4 text-tse-muted transition-transform",
              filtrosAbertos && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        {filtrosAbertos ? (
          <div className="space-y-3 border-t border-[#EEEEEE] px-4 py-3">
            <SelectField label="Situação" value={status} onChange={setStatus}>
              <option value="todas">Todas</option>
              <option value="em_voo">Em voo</option>
              <option value="confirmado">Confirmado</option>
              <option value="previsto">Previsto</option>
              <option value="concluido">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </SelectField>
          </div>
        ) : null}
        <div className="border-t border-[#EEEEEE] px-4 py-3">
          <label className="relative block">
            <span className="sr-only">Buscar voos</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tse-muted"
              aria-hidden
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por cidade, passageiro ou finalidade"
              className="h-11 w-full rounded-xl border border-tse-line bg-tse-bg/40 pr-3 pl-10 text-[14px] outline-none focus:border-tse-olive"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {FINALIDADES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={purpose === item.id}
                onClick={() => setPurpose(item.id)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[13px] font-bold",
                  purpose === item.id
                    ? "bg-tse-text text-white"
                    : "border border-[#EEF0F3] bg-white text-tse-muted",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {trips.length === 0 ? (
        <EmptyState>Nada encontrado com esses filtros.</EmptyState>
      ) : (
        <>
          <p className="text-[13px] text-tse-muted">
            {trips.length} voo{trips.length === 1 ? "" : "s"} · {formatHours(horas)} no período
          </p>

          {/* Mobile: cards */}
          <section className="overflow-hidden rounded-2xl border border-[#EEF0F3] bg-white shadow-sm md:hidden">
            <ul className="divide-y divide-[#EEEEEE]">
              {trips.map((trip) => (
                <li key={trip.id}>
                  <CartaoVoo trip={trip} />
                </li>
              ))}
            </ul>
          </section>

          {/* Desktop: tabela */}
          <div className="hidden md:block">
            <TableWrap>
              <table className={tableClass}>
                <thead className={theadClass}>
                  <tr>
                    <th className={thClass}>Quando</th>
                    <th className={thClass}>Itinerário</th>
                    <th className={thClass}>Aeronave</th>
                    {!partnerId ? <th className={thClass}>Pediu</th> : null}
                    <th className={thClass}>Horas</th>
                    <th className={thClass}>Custo</th>
                    <th className={thClass}>Situação</th>
                    <th className={thClass}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((trip) => {
                    const span = itinerarySpan(trip);
                    const hours = tripHours(trip);
                    const cost = expensesOfItinerary(trip.id).reduce(
                      (sum, item) => sum + item.amount,
                      0,
                    );
                    const craft = getAircraft(trip.aircraftId);
                    return (
                      <tr key={trip.id} className={trClass}>
                        <td className={tdClass}>
                          {span
                            ? span.first === span.last
                              ? formatDateShort(span.first)
                              : `${formatDateShort(span.first)}–${formatDateShort(span.last)}`
                            : "—"}
                        </td>
                        <td className={tdClass}>
                          <Link href={`/itinerarios/${trip.id}`} className="font-bold hover:underline">
                            {itineraryCities(trip) || trip.title}
                          </Link>
                          <span className="block text-[12px] text-tse-muted">
                            {itineraryRoute(trip)} · {PURPOSE_LABEL[trip.purpose]}
                          </span>
                        </td>
                        <td className={tdClass}>{craft?.registration}</td>
                        {!partnerId ? (
                          <td className={tdClass}>{partnerShort(trip.requestedBy)}</td>
                        ) : null}
                        <td className={`${tdClass} tabular-nums`}>
                          {formatHours(hours.voadas + hours.previstas)}
                        </td>
                        <td className={`${tdClass} tabular-nums`}>
                          {trip.status === "cancelado" ? "—" : formatBRL(cost)}
                        </td>
                        <td className={tdClass}>
                          <StatusBadge value={trip.status} />
                        </td>
                        <td className={tdClass}>
                          <LinkEditar href={`/itinerarios/${trip.id}/editar`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </div>
        </>
      )}

      <AcoesRelatorio
        titulo={partnerId ? "Relatório dos meus voos" : "Relatório de voos"}
        texto={
          partnerId
            ? "Baixa o resumo e a lista dos seus voos neste período em PDF ou Excel."
            : "Baixa o resumo e a lista de voos do recorte atual em PDF ou Excel."
        }
        gerar={() => relatorioVoos(months, aircraftId, partnerId)}
      />
    </PageStack>
  );
}

function MetricaIcone({
  icone: Icone,
  label,
  value,
}: {
  icone: typeof Plane;
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

function cidadesCurtas(trip: Itinerary): string {
  const first = trip.legs[0];
  if (!first) return trip.title;
  const nomes = [first.fromCity.trim() || first.fromIcao, ...trip.legs.map((leg) => leg.toCity.trim() || leg.toIcao)];
  const compact: string[] = [];
  for (const nome of nomes) {
    if (compact[compact.length - 1] !== nome) compact.push(nome);
  }
  return compact.join(" → ");
}

function CartaoVoo({ trip }: { trip: Itinerary }) {
  const span = itinerarySpan(trip);
  const hours = tripHours(trip);
  const data = span?.first ? formatDateLista(span.first) : "—";

  return (
    <Link href={`/itinerarios/${trip.id}`} className="flex items-start gap-3 px-4 py-3.5">
      <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-tse-olive">
        <Plane className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[15px] font-bold">{cidadesCurtas(trip)}</span>
          <span className="shrink-0 text-[15px] font-bold tabular-nums">
            {formatHours(hours.voadas + hours.previstas)}
          </span>
        </span>
        <span className="mt-0.5 block text-[12px] text-tse-muted">
          {data} · {PURPOSE_LABEL[trip.purpose]}
        </span>
        <span className="block text-[12px] text-tse-muted">{itineraryRoute(trip)}</span>
      </span>
      <ChevronRight className="mt-1 size-4 shrink-0 text-tse-muted" aria-hidden />
    </Link>
  );
}
