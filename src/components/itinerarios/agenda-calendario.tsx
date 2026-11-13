"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronRight as Seta, Pencil, Plane, Plus, Trash2 } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { cn, formatBRL, formatHours, formatPercent } from "@/lib/format";
import { corDoSocio, fundoCalendarioSocio, PURPOSE_LABEL } from "@/lib/labels";
import { criarId, excluirFaixaEscala, salvarFaixaEscala } from "@/services/acoes";
import {
  escalasIn,
  expensesOfItinerary,
  getAircraft,
  itinerariesIn,
  itineraryRoute,
  itinerarySpan,
  listAircraft,
  listMonths,
  mesDeReferencia,
  MONTHS,
  partnerShort,
  tripHours,
  type MonthFilter,
} from "@/services/operacao";
import type { FaixaEscala, Itinerary } from "@/types/operacao";

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

type DiaAgenda = {
  iso: string;
  dia: number;
  foraDoMes: boolean;
  /** Posse do dia na escala (independente de quem voou). */
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
  const base = useDados();
  const { aircraftId, months, setMonths, partnerId } = useOperacao();
  const mesAtivo = mesDeReferencia(months);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [editandoEscala, setEditandoEscala] = useState<boolean>(false);

  const voosMes = useMemo(
    () =>
      itinerariesIn([mesAtivo], aircraftId)
        .filter((trip) => trip.status !== "cancelado")
        .sort((left, right) => (left.legs[0]?.date ?? "").localeCompare(right.legs[0]?.date ?? "")),
    [aircraftId, mesAtivo, base.itineraries],
  );

  const escalasMes = useMemo(
    () => escalasIn(mesAtivo, aircraftId),
    [aircraftId, mesAtivo, base.escalas],
  );

  const grade = useMemo(
    () => montarGrade(mesAtivo, voosMes, escalasMes),
    [mesAtivo, voosMes, escalasMes],
  );
  const resumo = useMemo(() => resumoSocios(grade), [grade]);
  const faixas = useMemo(() => faixasDoMes(grade), [grade]);
  const diasNoMes = grade.filter((item) => !item.foraDoMes).length;

  // Só destaca o dia depois do toque — não pré-seleciona o primeiro com voo.
  const diaAtivo =
    diaSelecionado && diaSelecionado.startsWith(mesAtivo) ? diaSelecionado : null;

  const celulaAtiva = diaAtivo
    ? (grade.find((item) => item.iso === diaAtivo) ?? null)
    : null;
  const posseDia = celulaAtiva?.partnerId ?? null;
  const voosDoDia = celulaAtiva?.voos ?? [];

  const mesLabel =
    MONTHS.find((item) => item.id === mesAtivo)?.label ??
    listMonths().find((item) => item.id === mesAtivo)?.label ??
    mesAtivo;

  const aeronaveEscala =
    aircraftId !== "todas"
      ? aircraftId
      : (listAircraft()[0]?.id ?? "");

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
            const temPosse = Boolean(celula.partnerId);
            const temVoo = celula.voos.length > 0;
            const voosOutro = celula.partnerId
              ? celula.voos.filter((trip) => trip.requestedBy !== celula.partnerId)
              : celula.voos;
            const marcadorOutro = voosOutro[0]?.requestedBy ?? null;
            return (
              <button
                key={celula.iso}
                type="button"
                onClick={() => setDiaSelecionado(celula.iso)}
                className={cn(
                  "relative flex min-h-[44px] flex-col rounded-lg px-1 py-1 text-left transition sm:min-h-[56px] sm:rounded-xl sm:px-1.5 sm:py-1.5",
                  !temPosse && "bg-[#F7F7F5]",
                  selecionado && "ring-2 ring-[#6B5B95] ring-offset-1",
                )}
                style={
                  temPosse && celula.partnerId
                    ? { background: fundoCalendarioSocio(celula.partnerId) }
                    : undefined
                }
              >
                <span className="flex items-start justify-between gap-0.5">
                  <span className="text-[11px] font-bold tabular-nums sm:text-[12px]">
                    {celula.dia}
                  </span>
                  {marcadorOutro ? (
                    <span
                      className="mt-0.5 size-1.5 shrink-0 rounded-full sm:size-2"
                      style={{ background: corDoSocio(marcadorOutro) }}
                      title={`Voo de ${partnerShort(marcadorOutro)}`}
                    />
                  ) : temVoo ? (
                    <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-[#6B5B95]/40 sm:size-2" />
                  ) : null}
                </span>
                {temPosse && celula.partnerId ? (
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

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-tse-muted">
            Cor = posse na escala. Ponto = voo{partnerId ? "" : " (pode ser de outro sócio)"}.
          </p>
          {aeronaveEscala ? (
            <button
              type="button"
              onClick={() => setEditandoEscala((atual) => !atual)}
              className="inline-flex items-center gap-1 text-[12px] font-bold text-[#6B5B95]"
            >
              <Pencil className="size-3.5" aria-hidden />
              {editandoEscala ? "Fechar escala" : "Editar escala"}
            </button>
          ) : null}
        </div>

        {editandoEscala && aeronaveEscala ? (
          <EditorEscala
            month={mesAtivo}
            aircraftId={aeronaveEscala}
            faixas={escalasIn(mesAtivo, aeronaveEscala)}
          />
        ) : null}
      </section>

      {resumo.length > 0 ? (
        <section className="hidden rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:block sm:p-5">
          <p className="text-[13px] font-bold">Dias com a aeronave × escala</p>
          <ul className="mt-3 space-y-4">
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
                      {item.dias} / {item.dias} dias
                    </span>
                    <span className="block text-[11px] text-tse-muted">na escala</span>
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
            A linha vertical da cota fica no painel. Aqui a cor marca a posse do dia.
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
                {!diaAtivo
                  ? "Toque em um dia no calendário."
                  : posseDia
                    ? `Período de ${partnerShort(posseDia)}${
                        voosDoDia.length === 0
                          ? " · nenhum voo"
                          : ` · ${voosDoDia.length} voo${voosDoDia.length === 1 ? "" : "s"}`
                      }`
                    : voosDoDia.length === 0
                      ? "Dia sem posse na escala."
                      : `${voosDoDia.length} voo${voosDoDia.length === 1 ? "" : "s"} · sem posse cadastrada`}
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

          {!diaAtivo ? (
            <div className="mt-3">
              <EmptyState>Escolha um dia para ver os voos.</EmptyState>
            </div>
          ) : voosDoDia.length === 0 ? (
            <div className="mt-3">
              <EmptyState>Toque em outro dia ou marque um voo.</EmptyState>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-[#EEEEEE]">
              {voosDoDia.map((trip) => (
                <li key={trip.id}>
                  <CartaoVoo
                    trip={trip}
                    mostrarSocio
                    possePartnerId={posseDia}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : diaAtivo && voosDoDia.length > 0 ? (
        <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
          <p className="text-[13px] font-bold">
            Voos em {formatDiaMes(diaAtivo)}
            {posseDia ? (
              <span className="font-normal text-tse-muted">
                {" "}
                · período de {partnerShort(posseDia)}
              </span>
            ) : null}
          </p>
          <ul className="mt-2 divide-y divide-[#EEEEEE]">
            {voosDoDia.slice(0, 3).map((trip) => (
              <li key={trip.id}>
                <CartaoVoo trip={trip} mostrarSocio possePartnerId={posseDia} />
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

function EditorEscala({
  month,
  aircraftId,
  faixas,
}: {
  month: string;
  aircraftId: string;
  faixas: FaixaEscala[];
}) {
  const base = useDados();
  const craft = getAircraft(aircraftId);
  const ultimo = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();
  const [partnerId, setPartnerId] = useState<string>(base.partners[0]?.id ?? "");
  const [inicio, setInicio] = useState<string>("1");
  const [fim, setFim] = useState<string>(String(Math.min(10, ultimo)));
  const [erro, setErro] = useState<string>("");

  function adicionar() {
    const startDay = Number(inicio);
    const endDay = Number(fim);
    const item: FaixaEscala = {
      id: criarId("esc"),
      aircraftId,
      month,
      partnerId,
      startDay,
      endDay,
    };
    const falha = salvarFaixaEscala(item);
    if (falha) {
      setErro(falha);
      return;
    }
    setErro("");
  }

  return (
    <div className="mt-3 rounded-xl border border-[#E8E4F5] bg-[#F7F5FB] p-3">
      <p className="text-[12px] font-bold text-[#6B5B95]">
        Escala · {craft?.registration ?? aircraftId} · {month}
      </p>
      <p className="mt-0.5 text-[11px] text-tse-muted">
        Cadastre quem fica com a aeronave em cada faixa de dias. O custo do voo continua com quem
        pediu.
      </p>

      {faixas.length > 0 ? (
        <ul className="mt-2 divide-y divide-[#E8E4F5]">
          {faixas.map((faixa) => (
            <li key={faixa.id} className="flex items-center justify-between gap-2 py-2">
              <span className="inline-flex min-w-0 items-center gap-2 text-[13px]">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: corDoSocio(faixa.partnerId) }}
                />
                <span className="truncate font-semibold">
                  {partnerShort(faixa.partnerId)}
                </span>
                <span className="tabular-nums text-tse-muted">
                  {String(faixa.startDay).padStart(2, "0")}–{String(faixa.endDay).padStart(2, "0")}
                </span>
              </span>
              <button
                type="button"
                onClick={() => excluirFaixaEscala(faixa.id)}
                className="inline-flex size-8 items-center justify-center rounded-full text-tse-muted hover:bg-white hover:text-[#8B5E3C]"
                aria-label={`Remover faixa de ${partnerShort(faixa.partnerId)}`}
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[12px] text-tse-muted">Nenhuma faixa neste mês.</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="col-span-2 block text-[11px] font-semibold text-tse-muted sm:col-span-1">
          Sócio
          <select
            value={partnerId}
            onChange={(event) => setPartnerId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#E8E4F5] bg-white px-2 py-1.5 text-[13px] text-tse-text"
          >
            {base.partners.map((item) => (
              <option key={item.id} value={item.id}>
                {item.shortName}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[11px] font-semibold text-tse-muted">
          De
          <input
            type="number"
            min={1}
            max={ultimo}
            value={inicio}
            onChange={(event) => setInicio(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#E8E4F5] bg-white px-2 py-1.5 text-[13px] tabular-nums text-tse-text"
          />
        </label>
        <label className="block text-[11px] font-semibold text-tse-muted">
          Até
          <input
            type="number"
            min={1}
            max={ultimo}
            value={fim}
            onChange={(event) => setFim(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#E8E4F5] bg-white px-2 py-1.5 text-[13px] tabular-nums text-tse-text"
          />
        </label>
        <div className="col-span-2 flex items-end sm:col-span-1">
          <button
            type="button"
            onClick={adicionar}
            className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-[#6B5B95] px-3 py-1.5 text-[12px] font-bold text-white"
          >
            <Plus className="size-3.5" aria-hidden />
            Incluir
          </button>
        </div>
      </div>
      {erro ? <p className="mt-2 text-[12px] font-semibold text-[#8B5E3C]">{erro}</p> : null}
    </div>
  );
}

function montarGrade(
  mesId: string,
  voos: Itinerary[],
  escalas: FaixaEscala[],
): DiaAgenda[] {
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

  function posseNoDia(dia: number): string | null {
    const faixa = escalas.find((item) => dia >= item.startDay && dia <= item.endDay);
    return faixa?.partnerId ?? null;
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
    celulas.push({
      iso,
      dia,
      foraDoMes: false,
      partnerId: posseNoDia(dia),
      voos: porDia.get(iso) ?? [],
    });
  }

  return celulas;
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

function CartaoVoo({
  trip,
  mostrarSocio,
  possePartnerId,
}: {
  trip: Itinerary;
  mostrarSocio: boolean;
  possePartnerId?: string | null;
}) {
  const hours = tripHours(trip);
  const cost = expensesOfItinerary(trip.id).reduce((sum, item) => sum + item.amount, 0);
  const span = itinerarySpan(trip);
  const vooDeOutro =
    possePartnerId && trip.requestedBy !== possePartnerId
      ? `Voo de ${partnerShort(trip.requestedBy)} no período de ${partnerShort(possePartnerId)}`
      : null;

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
          {mostrarSocio && !vooDeOutro ? `${partnerShort(trip.requestedBy)} · ` : ""}
          {PURPOSE_LABEL[trip.purpose]}
          {span && span.first !== span.last ? ` · até ${formatDiaMes(span.last)}` : ""}
        </span>
        {vooDeOutro ? (
          <span className="mt-1 block text-[12px] font-semibold text-[#8B5E3C]">
            {vooDeOutro}
          </span>
        ) : null}
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
