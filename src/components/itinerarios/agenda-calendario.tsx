"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronRight as Seta, Plane, Plus } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { cn, formatBRL, formatHours, formatPercent } from "@/lib/format";
import { corDoSocio, fundoCalendarioSocio, PURPOSE_LABEL } from "@/lib/labels";
import {
  expensesOfItinerary,
  itinerariesIn,
  itineraryRoute,
  itinerarySpan,
  listMonths,
  mesDeReferencia,
  MONTHS,
  partnerShort,
  tripHours,
  type MonthFilter,
} from "@/services/operacao";
import type { Itinerary } from "@/types/operacao";

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

type DiaAgenda = {
  iso: string;
  dia: number;
  foraDoMes: boolean;
  partnerId: string | null;
  voos: Itinerary[];
};

type ResumoSocio = {
  partnerId: string;
  dias: number;
  pct: number;
};

type FaixaSocio = {
  partnerId: string;
  inicio: number;
  fim: number;
  dias: number;
};

export function AgendaCalendario({
  compacto = false,
}: {
  /** No painel: calendário + resumo, sem o bloco longo do dia. */
  compacto?: boolean;
}) {
  const { aircraftId, months, setMonths, partnerId } = useOperacao();
  const mesAtivo = mesDeReferencia(months);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const voosMes = useMemo(
    () =>
      itinerariesIn([mesAtivo], aircraftId)
        .filter((trip) => trip.status !== "cancelado")
        .sort((left, right) => (left.legs[0]?.date ?? "").localeCompare(right.legs[0]?.date ?? "")),
    [aircraftId, mesAtivo],
  );

  const grade = useMemo(() => montarGrade(mesAtivo, voosMes), [mesAtivo, voosMes]);
  const resumo = useMemo(() => resumoSocios(grade), [grade]);
  const faixas = useMemo(() => faixasDoMes(grade), [grade]);
  const diasNoMes = grade.filter((item) => !item.foraDoMes).length;

  const diaAtivo =
    diaSelecionado && diaSelecionado.startsWith(mesAtivo)
      ? diaSelecionado
      : (grade.find((item) => !item.foraDoMes && item.voos.length > 0)?.iso ?? null);

  const voosDoDia = diaAtivo
    ? (grade.find((item) => item.iso === diaAtivo)?.voos ?? []).filter(
        (trip) => !partnerId || trip.requestedBy === partnerId,
      )
    : [];

  const mesLabel =
    MONTHS.find((item) => item.id === mesAtivo)?.label ??
    listMonths().find((item) => item.id === mesAtivo)?.label ??
    mesAtivo;

  function irMes(delta: number) {
    const [anoTexto, mesTexto] = mesAtivo.split("-");
    const ano = Number(anoTexto);
    const mes = Number(mesTexto);
    if (!ano || !mes) return;
    const data = new Date(ano, mes - 1 + delta, 1);
    const id = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    setMonths([id] as MonthFilter);
    setDiaSelecionado(null);
  }

  return (
    <>
      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-2.5 shadow-sm sm:p-4">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <button
            type="button"
            onClick={() => irMes(-1)}
            className="inline-flex size-8 items-center justify-center rounded-full text-tse-muted hover:bg-tse-bg"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <div className="min-w-0 text-center">
            <p className="text-[10px] font-bold tracking-wide text-tse-muted uppercase">
              Agenda de voos
            </p>
            <h2 className="text-[16px] font-bold tracking-tight sm:text-[18px]">{mesLabel}</h2>
          </div>
          <button
            type="button"
            onClick={() => irMes(1)}
            className="inline-flex size-8 items-center justify-center rounded-full text-tse-muted hover:bg-tse-bg"
            aria-label="Próximo mês"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>

        <div className="mt-1.5 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-tse-muted sm:mt-2 sm:gap-1 sm:text-[11px]">
          {DIAS_SEMANA.map((dia) => (
            <div key={dia} className="py-0.5">
              {dia}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {grade.map((celula) => {
            if (celula.foraDoMes) {
              return <div key={`vazio-${celula.iso}`} className="min-h-[44px] sm:min-h-[56px]" />;
            }
            const selecionado = celula.iso === diaAtivo;
            const temVoo = celula.voos.length > 0;
            return (
              <button
                key={celula.iso}
                type="button"
                onClick={() => setDiaSelecionado(celula.iso)}
                className={cn(
                  "flex min-h-[44px] flex-col rounded-lg px-1 py-1 text-left transition sm:min-h-[56px] sm:rounded-xl sm:px-1.5 sm:py-1.5",
                  !temVoo && "bg-[#F7F7F5]",
                  selecionado && "ring-2 ring-[#6B5B95] ring-offset-1",
                )}
                style={
                  temVoo && celula.partnerId
                    ? { background: fundoCalendarioSocio(celula.partnerId) }
                    : undefined
                }
              >
                <span className="text-[11px] font-bold tabular-nums sm:text-[12px]">
                  {celula.dia}
                </span>
                {temVoo && celula.partnerId ? (
                  <span className="mt-auto truncate text-[9px] font-semibold leading-tight sm:text-[10px]">
                    {partnerShort(celula.partnerId)}
                  </span>
                ) : (
                  <span className="mt-auto text-[9px] text-tse-muted sm:text-[10px]">—</span>
                )}
              </button>
            );
          })}
        </div>

        {faixas.length > 0 ? (
          <div className="mt-2.5 space-y-1 sm:mt-3">
            <div className="flex h-1.5 overflow-hidden rounded-full bg-tse-bg sm:h-2">
              {faixas.map((faixa) => (
                <span
                  key={`${faixa.partnerId}-${faixa.inicio}`}
                  title={`${String(faixa.inicio).padStart(2, "0")}–${String(faixa.fim).padStart(2, "0")} ${partnerShort(faixa.partnerId)}`}
                  style={{
                    width: `${(faixa.dias / Math.max(diasNoMes, 1)) * 100}%`,
                    background: corDoSocio(faixa.partnerId),
                  }}
                />
              ))}
            </div>
            <div className="hidden flex-wrap gap-x-4 gap-y-1 text-[12px] text-tse-muted sm:flex">
              {faixas.map((faixa) => (
                <span
                  key={`legenda-${faixa.partnerId}-${faixa.inicio}`}
                  className="inline-flex items-center gap-1.5"
                >
                  <span
                    className="size-2 rounded-sm"
                    style={{ background: corDoSocio(faixa.partnerId) }}
                  />
                  {String(faixa.inicio).padStart(2, "0")}–{String(faixa.fim).padStart(2, "0")}{" "}
                  {partnerShort(faixa.partnerId)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {resumo.length > 0 ? (
        <section className="hidden rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:block sm:p-5">
          <ul className="space-y-4">
            {resumo.map((item) => (
              <li key={item.partnerId}>
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="inline-flex min-w-0 items-center gap-2 font-bold">
                    <span
                      className="size-3 shrink-0 rounded-sm"
                      style={{ background: corDoSocio(item.partnerId) }}
                    />
                    <span className="truncate">{partnerShort(item.partnerId)}</span>
                    <span className="font-semibold text-tse-muted">{formatPercent(item.pct)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold tabular-nums">
                      {item.dias} de {item.dias} dias
                    </span>
                    <span className="block text-[11px] text-tse-muted">com voo</span>
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-tse-bg">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.max(4, item.pct * 100)}%`,
                      background: corDoSocio(item.partnerId),
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] text-tse-muted">
            Toque em um dia para ver os voos ou marcar um novo.
          </p>
          {compacto ? (
            <div className="mt-3">
              <Link
                href="/itinerarios"
                className="inline-flex items-center gap-1 text-[13px] font-bold text-tse-olive"
              >
                Ver lista de voos
                <Seta className="size-4" aria-hidden />
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {compacto ? (
        <div className="sm:hidden">
          <Link
            href="/itinerarios"
            className="inline-flex items-center gap-1 text-[13px] font-bold text-tse-olive"
          >
            Ver lista de voos
            <Seta className="size-4" aria-hidden />
          </Link>
        </div>
      ) : null}

      {!compacto ? (
        <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-bold">
                {diaAtivo ? `Voos em ${formatDiaMes(diaAtivo)}` : "Voos do dia"}
              </p>
              <p className="mt-0.5 text-[12px] text-tse-muted">
                {voosDoDia.length === 0
                  ? "Nenhum voo neste dia."
                  : `${voosDoDia.length} voo${voosDoDia.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <Link
              href="/itinerarios/novo"
              className="inline-flex items-center gap-1 text-[13px] font-bold text-tse-olive"
            >
              <Plus className="size-4" aria-hidden />
              Marcar
            </Link>
          </div>

          {voosDoDia.length === 0 ? (
            <div className="mt-3">
              <EmptyState>Toque em outro dia ou marque um voo.</EmptyState>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-[#EEEEEE]">
              {voosDoDia.map((trip) => (
                <li key={trip.id}>
                  <CartaoVoo trip={trip} mostrarSocio={!partnerId} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : diaAtivo && voosDoDia.length > 0 ? (
        <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
          <p className="text-[13px] font-bold">Voos em {formatDiaMes(diaAtivo)}</p>
          <ul className="mt-2 divide-y divide-[#EEEEEE]">
            {voosDoDia.slice(0, 3).map((trip) => (
              <li key={trip.id}>
                <CartaoVoo trip={trip} mostrarSocio={!partnerId} />
              </li>
            ))}
          </ul>
          {voosDoDia.length > 3 ? (
            <Link
              href="/itinerarios"
              className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-tse-olive"
            >
              Ver todos os voos do dia
              <Seta className="size-4" aria-hidden />
            </Link>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function montarGrade(mesId: string, voos: Itinerary[]): DiaAgenda[] {
  const [anoTexto, mesTexto] = mesId.split("-");
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  if (!ano || !mes) return [];

  const primeiro = new Date(ano, mes - 1, 1);
  const totalDias = new Date(ano, mes, 0).getDate();
  const offset = primeiro.getDay();
  const porDia = new Map<string, Itinerary[]>();

  for (const trip of voos) {
    const datas = new Set(trip.legs.map((leg) => leg.date.slice(0, 10)));
    for (const data of datas) {
      if (!data.startsWith(mesId)) continue;
      const lista = porDia.get(data) ?? [];
      lista.push(trip);
      porDia.set(data, lista);
    }
  }

  const celulas: DiaAgenda[] = [];
  for (let i = 0; i < offset; i += 1) {
    celulas.push({
      iso: `${mesId}-pad-${i}`,
      dia: 0,
      foraDoMes: true,
      partnerId: null,
      voos: [],
    });
  }

  for (let dia = 1; dia <= totalDias; dia += 1) {
    const iso = `${mesId}-${String(dia).padStart(2, "0")}`;
    const voosDia = porDia.get(iso) ?? [];
    celulas.push({
      iso,
      dia,
      foraDoMes: false,
      partnerId: socioDoDia(voosDia),
      voos: voosDia,
    });
  }

  return celulas;
}

function socioDoDia(voos: Itinerary[]): string | null {
  if (voos.length === 0) return null;
  const horas = new Map<string, number>();
  for (const trip of voos) {
    const h = tripHours(trip);
    horas.set(trip.requestedBy, (horas.get(trip.requestedBy) ?? 0) + h.voadas + h.previstas);
  }
  let melhor: string | null = null;
  let max = -1;
  for (const [id, valor] of horas) {
    if (valor > max) {
      max = valor;
      melhor = id;
    }
  }
  return melhor;
}

function resumoSocios(grade: DiaAgenda[]): ResumoSocio[] {
  const diasMes = grade.filter((item) => !item.foraDoMes).length;
  const contagem = new Map<string, number>();
  for (const dia of grade) {
    if (dia.foraDoMes || !dia.partnerId) continue;
    contagem.set(dia.partnerId, (contagem.get(dia.partnerId) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([partnerId, dias]) => ({
      partnerId,
      dias,
      pct: diasMes > 0 ? dias / diasMes : 0,
    }))
    .sort((a, b) => b.dias - a.dias);
}

function faixasDoMes(grade: DiaAgenda[]): FaixaSocio[] {
  const dias = grade.filter((item) => !item.foraDoMes);
  const faixas: FaixaSocio[] = [];
  let atual: FaixaSocio | null = null;

  for (const dia of dias) {
    if (!dia.partnerId) {
      atual = null;
      continue;
    }
    if (atual && atual.partnerId === dia.partnerId && dia.dia === atual.fim + 1) {
      atual.fim = dia.dia;
      atual.dias += 1;
      continue;
    }
    atual = {
      partnerId: dia.partnerId,
      inicio: dia.dia,
      fim: dia.dia,
      dias: 1,
    };
    faixas.push(atual);
  }

  return faixas;
}

function formatDiaMes(iso: string): string {
  const [, , dia] = iso.split("-");
  const mes = Number(iso.slice(5, 7));
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${Number(dia)} ${nomes[mes - 1] ?? ""}`;
}

function cidadesCurtas(trip: Itinerary): string {
  const first = trip.legs[0];
  if (!first) return trip.title;
  const nomes = [
    first.fromCity.trim() || first.fromIcao,
    ...trip.legs.map((leg) => leg.toCity.trim() || leg.toIcao),
  ];
  const compact: string[] = [];
  for (const nome of nomes) {
    if (compact[compact.length - 1] !== nome) compact.push(nome);
  }
  return compact.join(" → ");
}

function CartaoVoo({ trip, mostrarSocio }: { trip: Itinerary; mostrarSocio: boolean }) {
  const hours = tripHours(trip);
  const cost = expensesOfItinerary(trip.id).reduce((sum, item) => sum + item.amount, 0);
  const span = itinerarySpan(trip);

  return (
    <Link href={`/itinerarios/${trip.id}`} className="flex items-start gap-3 py-3.5">
      <span
        className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ background: corDoSocio(trip.requestedBy) }}
      >
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
          {mostrarSocio ? `${partnerShort(trip.requestedBy)} · ` : ""}
          {PURPOSE_LABEL[trip.purpose]}
          {span && span.first !== span.last ? ` · até ${formatDiaMes(span.last)}` : ""}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <StatusBadge value={trip.status} />
          <span className="text-[12px] text-tse-muted">{itineraryRoute(trip)}</span>
          {trip.status !== "cancelado" ? (
            <span className="text-[12px] font-semibold tabular-nums text-tse-muted">
              {formatBRL(cost)}
            </span>
          ) : null}
        </span>
      </span>
      <Seta className="mt-1 size-4 shrink-0 text-tse-muted" aria-hidden />
    </Link>
  );
}
