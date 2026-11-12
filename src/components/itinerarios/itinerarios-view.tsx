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
import { corDoSocio, PURPOSE_LABEL, STATUS_CLASS } from "@/lib/labels";
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

type AbaStatus = "todos" | "realizados" | "agendados" | "cancelados";

const ABAS: { id: AbaStatus; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "realizados", label: "Feitos" },
  { id: "agendados", label: "Agendados" },
  { id: "cancelados", label: "Cancelados" },
];

const FINALIDADES: { id: "todas" | Purpose; label: string }[] = [
  { id: "todas", label: "Todos" },
  { id: "negocios", label: "Negócios" },
  { id: "pessoal", label: "Pessoal" },
];

function passaStatus(trip: Itinerary, aba: AbaStatus): boolean {
  if (aba === "todos") return true;
  if (aba === "realizados") return trip.status === "concluido";
  if (aba === "cancelados") return trip.status === "cancelado";
  return trip.status === "confirmado" || trip.status === "previsto" || trip.status === "em_voo";
}

export function ItinerariosView() {
  useDados();
  const { aircraftId, months, partnerId } = useOperacao();
  const [aba, setAba] = useState<AbaStatus>("todos");
  const [purpose, setPurpose] = useState<"todas" | Purpose>("todas");
  const [query, setQuery] = useState<string>("");
  const [filtrosAbertos, setFiltrosAbertos] = useState<boolean>(false);

  const needle = query.trim().toLowerCase();
  const base = itinerariesIn(months, aircraftId)
    .filter((trip) => !partnerId || trip.requestedBy === partnerId)
    .sort((left, right) => (right.legs[0]?.date ?? "").localeCompare(left.legs[0]?.date ?? ""));

  const trips = base
    .filter((trip) => passaStatus(trip, aba))
    .filter((trip) => purpose === "todas" || trip.purpose === purpose)
    .filter((trip) => {
      if (!needle) return true;
      const blob = [
        trip.title,
        trip.note,
        itineraryCities(trip),
        itineraryRoute(trip),
        PURPOSE_LABEL[trip.purpose],
        partnerShort(trip.requestedBy),
        ...trip.passengers,
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(needle);
    });

  const horas = trips.reduce((sum, trip) => {
    if (trip.status === "cancelado") return sum;
    const hours = tripHours(trip);
    return sum + hours.voadas + hours.previstas;
  }, 0);
  const kpis = getKpis(months, aircraftId);
  const craftAtiva = aircraftId !== "todas" ? getAircraft(aircraftId) : null;
  const contextoPeriodo = [
    craftAtiva?.registration ?? (aircraftId === "todas" ? "Toda a operação" : aircraftId),
    monthsLabel(months),
  ].join(" · ");
  const titulo = partnerId ? "Meus voos" : "Voos";

  const contagem: Record<AbaStatus, number> = {
    todos: base.length,
    realizados: base.filter((trip) => trip.status === "concluido").length,
    agendados: base.filter(
      (trip) =>
        trip.status === "confirmado" || trip.status === "previsto" || trip.status === "em_voo",
    ).length,
    cancelados: base.filter((trip) => trip.status === "cancelado").length,
  };

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
        legenda={partnerId ? undefined : "Lista dos voos do período — realizados, agendados e cancelados."}
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

      <div className="-mx-4 sm:-mx-6 lg:-mx-8">
        <div className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden">
          {ABAS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={aba === item.id}
              onClick={() => setAba(item.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold whitespace-nowrap sm:text-[13px]",
                aba === item.id
                  ? "bg-tse-text text-white"
                  : "border border-[#EEF0F3] bg-white text-tse-muted",
              )}
            >
              {item.label}
              <span className="ml-1 tabular-nums opacity-70">{contagem[item.id]}</span>
            </button>
          ))}
          <span className="w-2 shrink-0" aria-hidden />
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#EEF0F3] bg-white shadow-sm">
        <button
          type="button"
          aria-expanded={filtrosAbertos}
          onClick={() => setFiltrosAbertos((atual) => !atual)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="text-[13px] font-bold">Filtrar lista</span>
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
            <div className="flex flex-wrap gap-2">
              {FINALIDADES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={purpose === item.id}
                  onClick={() => setPurpose(item.id)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-[13px] font-bold",
                    purpose === item.id
                      ? "bg-[#6B5B95] text-white"
                      : "border border-[#EEF0F3] bg-white text-tse-muted",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
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
        </div>
      </section>

      {trips.length === 0 ? (
        <EmptyState>Nenhum voo neste recorte.</EmptyState>
      ) : (
        <>
          <p className="text-[13px] text-tse-muted">
            {trips.length} voo{trips.length === 1 ? "" : "s"} · {formatHours(horas)}
          </p>

          <section className="overflow-hidden rounded-2xl border border-[#EEF0F3] bg-white shadow-sm md:hidden">
            <ul className="divide-y divide-[#EEEEEE]">
              {trips.map((trip) => (
                <li key={trip.id}>
                  <CartaoVoo trip={trip} mostrarSocio={!partnerId} />
                </li>
              ))}
            </ul>
          </section>

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

function rotaCurta(trip: Itinerary): string {
  const first = trip.legs[0];
  const last = trip.legs[trip.legs.length - 1];
  if (!first) return trip.title;
  const origem = first.fromCity.trim() || first.fromIcao;
  const destino = (last?.toCity.trim() || last?.toIcao) ?? origem;
  if (origem === destino && trip.legs.length <= 1) return origem;
  return `${origem} → ${destino}`;
}

function CartaoVoo({ trip, mostrarSocio }: { trip: Itinerary; mostrarSocio: boolean }) {
  const span = itinerarySpan(trip);
  const hours = tripHours(trip);
  const data = span?.first ? formatDateLista(span.first) : "—";

  return (
    <Link href={`/itinerarios/${trip.id}`} className="flex items-center gap-2.5 px-3 py-2.5">
      <span
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
        style={{ background: corDoSocio(trip.requestedBy) }}
      >
        <Plane className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px]">
        <span className="text-tse-muted">{data}</span>
        <span className="text-tse-muted"> · </span>
        <span className="font-bold text-tse-text">{rotaCurta(trip)}</span>
        {mostrarSocio ? (
          <>
            <span className="text-tse-muted"> · </span>
            <span className="text-tse-muted">{partnerShort(trip.requestedBy)}</span>
          </>
        ) : null}
      </span>
      <span className="shrink-0 text-[12px] font-bold tabular-nums">
        {formatHours(hours.voadas + hours.previstas)}
      </span>
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase",
          STATUS_CLASS[trip.status] ?? "bg-tse-bg text-tse-muted",
        )}
      >
        {statusCurto(trip.status)}
      </span>
      <ChevronRight className="size-4 shrink-0 text-tse-muted" aria-hidden />
    </Link>
  );
}

function statusCurto(status: ItineraryStatus): string {
  if (status === "concluido") return "Ok";
  if (status === "em_voo") return "Voo";
  if (status === "confirmado") return "Conf";
  if (status === "previsto") return "Prev";
  if (status === "cancelado") return "Canc";
  return status;
}
