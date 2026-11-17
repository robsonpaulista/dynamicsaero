"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { AcoesRelatorio } from "@/components/relatorios/acoes-relatorio";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import {
  PageStack,
  PilulaSocio,
  TableWrap,
  tableClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { baixarPdfConferenciaVibra } from "@/lib/baixar-pdf-conferencia";
import { cn, formatBRL, formatDate, formatHours } from "@/lib/format";
import { corDoSocio } from "@/lib/labels";
import {
  alocarTrechosVibra,
  desfazerAlocacaoNotaVibra,
  desfazerAlocacaoTrechoVibra,
  limparAlocacoesVibraTrechos,
} from "@/services/alocacoes-vibra";
import {
  conferenciaVibraManual,
  legIdsSaidaContinua,
  notasProximasVibra,
  type ConferenciaVibraLinha,
  type NotaVibraProxima,
} from "@/services/conferencia";
import { getAircraft, monthsLabel, partnerShort } from "@/services/operacao";
import { relatorioConferenciaVibra } from "@/services/relatorios-conferencia";

type Coluna =
  | "data"
  | "trecho"
  | "tempo"
  | "litros"
  | "socio"
  | "abast"
  | "litrosAbast"
  | "valor"
  | "status";

type Ordem = "asc" | "desc";
type Ordenacao = { coluna: Coluna; ordem: Ordem };

function formatLitros(value: number): string {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value)} L`;
}

function formatPrecoLitro(value: number | null): string {
  if (value == null || !(value > 0)) return "—";
  return `${new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value)}/L`;
}

function compararTexto(left: string | null | undefined, right: string | null | undefined, ordem: Ordem): number {
  const cmp = (left ?? "").localeCompare(right ?? "", "pt-BR", {
    sensitivity: "base",
    numeric: true,
  });
  return ordem === "asc" ? cmp : -cmp;
}

function compararNumero(
  left: number | null | undefined,
  right: number | null | undefined,
  ordem: Ordem,
): number {
  const a = typeof left === "number" && Number.isFinite(left) ? left : 0;
  const b = typeof right === "number" && Number.isFinite(right) ? right : 0;
  return ordem === "asc" ? a - b : b - a;
}

function rotuloSocio(linha: ConferenciaVibraLinha): string {
  return linha.rateioParticipacao ? "Participação" : partnerShort(linha.partnerId);
}

function ordenarLinhas(itens: ConferenciaVibraLinha[], ordenacao: Ordenacao): ConferenciaVibraLinha[] {
  const { coluna, ordem } = ordenacao;
  return [...itens].sort((left, right) => {
    switch (coluna) {
      case "data":
        return (
          compararTexto(left.date, right.date, ordem) ||
          compararNumero(left.ordem, right.ordem, "asc") ||
          compararTexto(left.legId, right.legId, "asc")
        );
      case "trecho":
        return compararTexto(left.route, right.route, ordem);
      case "tempo":
        return compararNumero(left.blockHours, right.blockHours, ordem);
      case "litros":
        return compararNumero(left.litrosCalc, right.litrosCalc, ordem);
      case "socio":
        return compararTexto(rotuloSocio(left), rotuloSocio(right), ordem);
      case "abast":
        return compararTexto(left.referencia, right.referencia, ordem);
      case "litrosAbast":
        return compararNumero(left.litrosAbast, right.litrosAbast, ordem);
      case "valor":
        return compararNumero(left.amount, right.amount, ordem);
      case "status":
        return compararTexto(left.status, right.status, ordem);
      default:
        return 0;
    }
  });
}

function CabecalhoOrdenavel({
  coluna,
  atual,
  onOrdenar,
  children,
  className,
}: {
  coluna: Coluna;
  atual: Ordenacao;
  onOrdenar: (coluna: Coluna) => void;
  children: ReactNode;
  className?: string;
}) {
  const ativo = atual.coluna === coluna;
  const Icone = !ativo ? ArrowUpDown : atual.ordem === "asc" ? ArrowUp : ArrowDown;
  const alinharDireita = className?.includes("text-right");
  return (
    <th className={cn(thClass, className)}>
      <button
        type="button"
        onClick={() => onOrdenar(coluna)}
        className={cn(
          "inline-flex items-center gap-1 font-bold tracking-wide uppercase",
          alinharDireita && "w-full justify-end",
        )}
        aria-sort={ativo ? (atual.ordem === "asc" ? "ascending" : "descending") : "none"}
      >
        {children}
        <Icone className={cn("size-3.5", ativo ? "text-tse-olive" : "text-tse-muted")} aria-hidden />
      </button>
    </th>
  );
}

function BadgeStatus({ status }: { status: ConferenciaVibraLinha["status"] }) {
  if (status === "sem_abast") {
    return (
      <span className="inline-flex rounded-md bg-[#F7F8F9] px-2 py-0.5 text-[11px] font-bold text-tse-muted">
        Sem abast.
      </span>
    );
  }
  if (status === "atencao") {
    return (
      <span className="inline-flex rounded-md bg-[#FFF7ED] px-2 py-0.5 text-[11px] font-bold text-[#C2410C]">
        Atenção
      </span>
    );
  }
  if (status === "vizinho") {
    return (
      <span className="inline-flex rounded-md bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-bold text-[#1D4ED8]">
        Outro dia
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-md bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-bold text-[#15803D]">
      Alocado
    </span>
  );
}

function linhaTemSocio(linha: ConferenciaVibraLinha, socioId: string): boolean {
  if (linha.rateioParticipacao) return false;
  return linha.partnerId === socioId;
}

type FiltroAbastecimento = "todos" | "com" | "sem";

const FILTROS_ABAST: { id: FiltroAbastecimento; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "com", rotulo: "Com abastecimento" },
  { id: "sem", rotulo: "Sem abastecimento" },
];

function linhaTemAbastecimento(linha: ConferenciaVibraLinha): boolean {
  return linha.abastecimentoId != null;
}

export function ConferenciaVibraView() {
  const base = useDados();
  const { aircraftId, months, partnerId } = useOperacao();
  const [filtroSocio, setFiltroSocio] = useState<string | null>(null);
  const [filtroAbast, setFiltroAbast] = useState<FiltroAbastecimento>("todos");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>({ coluna: "data", ordem: "asc" });
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [modalAlocar, setModalAlocar] = useState<boolean>(false);
  const [avisoAlocacao, setAvisoAlocacao] = useState<string | null>(null);
  const tituloModalId = useId();

  useEffect(() => {
    setFiltroSocio(null);
    setFiltroAbast("todos");
    setSelecionados(new Set());
    setModalAlocar(false);
  }, [aircraftId, months, partnerId]);

  useEffect(() => {
    if (selecionados.size === 0) setModalAlocar(false);
  }, [selecionados.size]);

  useEffect(() => {
    if (!modalAlocar) return;
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setModalAlocar(false);
    };
    document.addEventListener("keydown", tecla);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = anterior;
    };
  }, [modalAlocar]);

  const dados = useMemo(
    () => conferenciaVibraManual(months, aircraftId),
    [months, aircraftId, base.alocacoesVibra],
  );

  const linhasFiltradas = useMemo(() => {
    return dados.linhas.filter((linha) => {
      if (filtroSocio && !linhaTemSocio(linha, filtroSocio)) return false;
      if (filtroAbast === "com" && !linhaTemAbastecimento(linha)) return false;
      if (filtroAbast === "sem" && linhaTemAbastecimento(linha)) return false;
      return true;
    });
  }, [dados.linhas, filtroSocio, filtroAbast]);

  const linhas = useMemo(
    () => ordenarLinhas(linhasFiltradas, ordenacao),
    [linhasFiltradas, ordenacao],
  );

  const legIdsSelecionados = useMemo(() => [...selecionados], [selecionados]);

  const notasProximas = useMemo(
    () =>
      legIdsSelecionados.length > 0
        ? notasProximasVibra(months, aircraftId, legIdsSelecionados)
        : [],
    [months, aircraftId, legIdsSelecionados, base.alocacoesVibra],
  );

  const litrosSelecionados = useMemo(
    () =>
      linhas
        .filter((linha) => selecionados.has(linha.legId))
        .reduce((soma, linha) => soma + linha.litrosCalc, 0),
    [linhas, selecionados],
  );

  function alternarOrdenacao(coluna: Coluna): void {
    setOrdenacao((atual) =>
      atual.coluna === coluna
        ? { coluna, ordem: atual.ordem === "asc" ? "desc" : "asc" }
        : {
            coluna,
            ordem:
              coluna === "data" ||
              coluna === "trecho" ||
              coluna === "socio" ||
              coluna === "abast" ||
              coluna === "status"
                ? "asc"
                : "desc",
          },
    );
  }

  function alternarSelecao(legId: string): void {
    setSelecionados((atual) => {
      const next = new Set(atual);
      if (next.has(legId)) next.delete(legId);
      else next.add(legId);
      return next;
    });
  }

  function selecionarSaida(legId: string): void {
    const ids = legIdsSaidaContinua(dados.linhas, legId);
    setSelecionados((atual) => {
      const next = new Set(atual);
      const todosMarcados = ids.every((id) => next.has(id));
      if (todosMarcados) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  }

  function selecionarTodosVisiveis(): void {
    if (linhas.length === 0) return;
    const ids = linhas.map((linha) => linha.legId);
    const todos = ids.every((id) => selecionados.has(id));
    setSelecionados(todos ? new Set() : new Set(ids));
  }

  function alocarNota(abastecimentoId: string): void {
    if (legIdsSelecionados.length === 0) return;
    const resultado = alocarTrechosVibra(legIdsSelecionados, abastecimentoId);
    if (!resultado.ok) {
      setAvisoAlocacao(resultado.motivo);
      return;
    }
    setAvisoAlocacao(null);
    setModalAlocar(false);
    setSelecionados(new Set());
  }

  function limparSelecaoAlocada(): void {
    if (legIdsSelecionados.length === 0) return;
    limparAlocacoesVibraTrechos(legIdsSelecionados);
    setModalAlocar(false);
    setSelecionados(new Set());
  }

  function cancelarSelecao(): void {
    setModalAlocar(false);
    setSelecionados(new Set());
  }

  function desfazerTrecho(legId: string): void {
    desfazerAlocacaoTrechoVibra(legId);
    setSelecionados((atual) => {
      if (!atual.has(legId)) return atual;
      const next = new Set(atual);
      next.delete(legId);
      return next;
    });
  }

  function desfazerNotaInteira(abastecimentoId: string): void {
    const idsGrupo = dados.linhas
      .filter((linha) => linha.abastecimentoId === abastecimentoId)
      .map((linha) => linha.legId);
    desfazerAlocacaoNotaVibra(abastecimentoId);
    setSelecionados((atual) => {
      if (idsGrupo.every((id) => !atual.has(id))) return atual;
      const next = new Set(atual);
      for (const id of idsGrupo) next.delete(id);
      return next;
    });
  }

  const selecaoTemAlocacao = useMemo(
    () =>
      linhas.some(
        (linha) => selecionados.has(linha.legId) && linha.abastecimentoId != null,
      ),
    [linhas, selecionados],
  );

  const contexto = [
    aircraftId === "todas"
      ? "Toda a operação"
      : (getAircraft(aircraftId)?.registration ?? aircraftId),
    monthsLabel(months),
  ].join(" · ");
  const socioFiltro = filtroSocio ? partnerShort(filtroSocio) : null;
  const alocados = dados.linhas.length - dados.semAbast;
  const todosVisiveisSelecionados =
    linhas.length > 0 && linhas.every((linha) => selecionados.has(linha.legId));

  return (
    <PageStack>
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight">Vibra · abastecimentos</h1>
        <p className="mt-0.5 text-[13px] text-tse-muted">
          Selecione trechos na tabela e use Escolher NF no rodapé · {contexto}.
        </p>
      </div>

      <FiltrosOperacao legenda="Selecione um ou vários trechos; o painel lista as NFs próximas do período para alocar." />

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">
          Checagem · alocação manual
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-[#F7F8F9] px-3 py-3">
            <p className="text-[11px] text-tse-muted">Trechos</p>
            <p className="mt-1 text-[22px] leading-none font-bold tabular-nums">
              {dados.linhas.length}
            </p>
            <p className="mt-1 text-[12px] text-tse-muted">
              {dados.semAbast > 0 ? `${dados.semAbast} sem abast.` : "todos alocados"}
            </p>
          </div>
          <div className="rounded-xl bg-[#F7F8F9] px-3 py-3">
            <p className="text-[11px] text-tse-muted">Alocados</p>
            <p className="mt-1 text-[22px] leading-none font-bold tabular-nums">{alocados}</p>
            <p className="mt-1 text-[12px] text-tse-muted">
              {dados.comVoo} NF(s) com trecho
            </p>
          </div>
          <div className="rounded-xl bg-[#F7F8F9] px-3 py-3">
            <p className="text-[11px] text-tse-muted">Comprovantes</p>
            <p className="mt-1 text-[22px] leading-none font-bold tabular-nums">
              {formatBRL(dados.totalValor)}
            </p>
            <p className="mt-1 text-[12px] text-tse-muted">
              {dados.totalAbastecimentos} abast. · {formatLitros(dados.totalLitros)}
            </p>
          </div>
          <div className="rounded-xl bg-[#F7F8F9] px-3 py-3">
            <p className="text-[11px] text-tse-muted">NFs sem trecho</p>
            <p className="mt-1 text-[22px] leading-none font-bold tabular-nums">
              {dados.semVoo}
            </p>
            <p className="mt-1 text-[12px] text-tse-muted">
              {dados.atencao > 0 ? `${dados.atencao} em atenção` : "aguardando alocação"}
            </p>
          </div>
        </div>

        {dados.porSolicitante.length > 0 ? (
          <ul className="mt-4 grid gap-3 border-t border-[#EEEEEE] pt-4 sm:grid-cols-3">
            {dados.porSolicitante.map((item) => {
              const ativo = filtroSocio === item.partnerId;
              const cor = corDoSocio(item.partnerId);
              return (
                <li key={item.partnerId}>
                  <button
                    type="button"
                    aria-pressed={ativo}
                    onClick={() =>
                      setFiltroSocio((atual) =>
                        atual === item.partnerId ? null : item.partnerId,
                      )
                    }
                    className={`w-full rounded-xl border px-3 py-3 text-left text-[13px] transition ${
                      ativo
                        ? "border-transparent bg-white shadow-[inset_0_0_0_2px_var(--cor-socio)]"
                        : "border-[#EEF0F3] bg-white hover:border-[#D7DCE3]"
                    }`}
                    style={
                      ativo
                        ? ({ ["--cor-socio"]: cor } as CSSProperties)
                        : undefined
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: cor }}
                        aria-hidden
                      />
                      <p className="font-semibold">{partnerShort(item.partnerId)}</p>
                      <p className="ml-auto text-[11px] text-tse-muted">
                        {item.trechos} trecho(s)
                        {ativo ? " · filtrando" : ""}
                      </p>
                    </div>
                    <dl className="mt-2 space-y-1 tabular-nums">
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-tse-muted">Combustível</dt>
                        <dd>{formatBRL(item.combustivel)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-tse-muted">Litros</dt>
                        <dd>{formatLitros(item.litros)}</dd>
                      </div>
                    </dl>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#EEEEEE] pt-4">
          <p className="mr-1 text-[11px] font-bold tracking-wide text-tse-muted uppercase">
            Abastecimento
          </p>
          {FILTROS_ABAST.map((item) => {
            const ativo = filtroAbast === item.id;
            const qtd =
              item.id === "com"
                ? alocados
                : item.id === "sem"
                  ? dados.semAbast
                  : dados.linhas.length;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => setFiltroAbast(item.id)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
                  ativo
                    ? "bg-tse-olive text-tse-text"
                    : "bg-[#F2F2F2] text-tse-muted hover:text-tse-text"
                }`}
              >
                {item.rotulo}
                <span className="ml-1.5 tabular-nums opacity-70">{qtd}</span>
              </button>
            );
          })}
        </div>
      </section>

      {linhas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-tse-border bg-white px-4 py-8 text-center text-[13px] text-tse-muted">
          {filtroSocio && filtroAbast !== "todos"
            ? `Nenhum trecho ${filtroAbast === "com" ? "com" : "sem"} abastecimento de ${partnerShort(filtroSocio)} neste recorte.`
            : filtroSocio
              ? `Nenhum trecho de ${partnerShort(filtroSocio)} neste recorte.`
              : filtroAbast === "com"
                ? "Nenhum trecho com abastecimento neste recorte."
                : filtroAbast === "sem"
                  ? "Nenhum trecho sem abastecimento neste recorte."
                  : "Nenhum trecho neste recorte."}
        </p>
      ) : (
        <TableWrap>
          <table className={`${tableClass} min-w-[1280px]`}>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>
                  <input
                    type="checkbox"
                    checked={todosVisiveisSelecionados}
                    onChange={selecionarTodosVisiveis}
                    aria-label="Selecionar todos os trechos visíveis"
                  />
                </th>
                <CabecalhoOrdenavel coluna="data" atual={ordenacao} onOrdenar={alternarOrdenacao}>
                  Data
                </CabecalhoOrdenavel>
                <CabecalhoOrdenavel coluna="trecho" atual={ordenacao} onOrdenar={alternarOrdenacao}>
                  Trecho
                </CabecalhoOrdenavel>
                <CabecalhoOrdenavel
                  coluna="tempo"
                  atual={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="text-right"
                >
                  Tempo
                </CabecalhoOrdenavel>
                <CabecalhoOrdenavel
                  coluna="litros"
                  atual={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="text-right"
                >
                  Litros
                </CabecalhoOrdenavel>
                <CabecalhoOrdenavel coluna="socio" atual={ordenacao} onOrdenar={alternarOrdenacao}>
                  Sócio
                </CabecalhoOrdenavel>
                <CabecalhoOrdenavel coluna="abast" atual={ordenacao} onOrdenar={alternarOrdenacao}>
                  NF alocada
                </CabecalhoOrdenavel>
                <CabecalhoOrdenavel
                  coluna="litrosAbast"
                  atual={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="text-right"
                >
                  Litros NF
                </CabecalhoOrdenavel>
                <CabecalhoOrdenavel
                  coluna="valor"
                  atual={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="text-right"
                >
                  Valor NF
                </CabecalhoOrdenavel>
                <CabecalhoOrdenavel coluna="status" atual={ordenacao} onOrdenar={alternarOrdenacao}>
                  Checagem
                </CabecalhoOrdenavel>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => {
                const marcada = selecionados.has(linha.legId);
                return (
                  <tr
                    key={linha.key}
                    className={cn(trClass, marcada && "bg-[#F7FAFF]")}
                  >
                    <td className={tdClass}>
                      <div className="flex flex-col gap-1">
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={() => alternarSelecao(linha.legId)}
                          aria-label={`Selecionar ${linha.route}`}
                        />
                        <button
                          type="button"
                          onClick={() => selecionarSaida(linha.legId)}
                          className="text-left text-[10px] font-semibold text-[#1D4ED8] hover:underline"
                          title="Seleciona a saída contínua do dia (destino → origem)"
                        >
                          saída
                        </button>
                      </div>
                    </td>
                    <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                      {formatDate(linha.date)}
                    </td>
                    <td className={`${tdClass} min-w-[220px]`}>
                      <Link
                        href={`/itinerarios/${linha.itineraryId}`}
                        className="font-semibold text-tse-text hover:underline"
                      >
                        {linha.route}
                      </Link>
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {linha.blockHours > 0 ? formatHours(linha.blockHours) : "—"}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums text-tse-muted`}>
                      {linha.litrosCalc > 0 ? formatLitros(linha.litrosCalc) : "—"}
                    </td>
                    <td className={tdClass}>
                      {linha.rateioParticipacao ? (
                        <PilulaSocio title="Traslado · rateio entre todos os sócios">
                          {rotuloSocio(linha)}
                        </PilulaSocio>
                      ) : (
                        <PilulaSocio partnerId={linha.partnerId}>{rotuloSocio(linha)}</PilulaSocio>
                      )}
                    </td>
                    <td className={tdClass}>
                      {linha.referencia ? (
                        <>
                          {linha.anexoUrl ? (
                            <a
                              href={linha.anexoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-tse-olive hover:underline"
                            >
                              Ref. {linha.referencia}
                            </a>
                          ) : (
                            <span className="font-semibold">Ref. {linha.referencia}</span>
                          )}
                          <p className="text-[11px] text-tse-muted">
                            {linha.icao}
                            {linha.abastDate ? ` · ${formatDate(linha.abastDate)}` : ""}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => desfazerTrecho(linha.legId)}
                              className="text-[11px] font-semibold text-[#8B5E3C] hover:underline"
                            >
                              Desfazer trecho
                            </button>
                            {linha.abastecimentoId && linha.primeiroDoGrupo ? (
                              <button
                                type="button"
                                onClick={() => desfazerNotaInteira(linha.abastecimentoId!)}
                                className="text-[11px] font-semibold text-[#8B5E3C] hover:underline"
                              >
                                Desfazer NF
                              </button>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <span className="text-tse-muted">—</span>
                      )}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums font-semibold`}>
                      {linha.litrosAbast != null ? formatLitros(linha.litrosAbast) : "—"}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {linha.amount != null ? (
                        <>
                          <p className="font-semibold">{formatBRL(linha.amount)}</p>
                          <p className="text-[11px] text-tse-muted">
                            {formatPrecoLitro(linha.precoLitro)}
                            {linha.notaNumero ? ` · NF ${linha.notaNumero}` : ""}
                          </p>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={tdClass}>
                      <BadgeStatus status={linha.status} />
                      {linha.saldoAposTrecho != null ? (
                        <p className="mt-1 text-[11px] tabular-nums text-tse-muted">
                          {linha.saldoAposTrecho > 1
                            ? `Sobram ${formatLitros(linha.saldoAposTrecho)} na NF`
                            : "NF sem saldo após este trecho"}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-tse-muted">{linha.detalhe}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-tse-border bg-tse-bg">
                <td className={`${tdClass} font-bold`} colSpan={6}>
                  Total · {linhas.length} trecho(s)
                  {socioFiltro ? ` · ${socioFiltro}` : ""}
                </td>
                <td className={tdClass} />
                <td className={`${tdClass} text-right font-bold tabular-nums`}>
                  {formatLitros(dados.totalLitros)}
                </td>
                <td className={`${tdClass} text-right font-bold tabular-nums`}>
                  {formatBRL(dados.totalValor)}
                </td>
                <td className={tdClass} />
              </tr>
            </tfoot>
          </table>
        </TableWrap>
      )}

      {dados.orfaos.length > 0 ? (
        <section className="rounded-2xl border border-[#F5E6D3] bg-[#FFFBF5] p-4 sm:p-5">
          <p className="text-[11px] font-bold tracking-wide text-[#8B5E3C] uppercase">
            Comprovantes sem trecho alocado
          </p>
          <ul className="mt-3 space-y-2 text-[13px]">
            {dados.orfaos.map((item) => (
              <li key={item.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-semibold tabular-nums">{formatDate(item.date)}</span>
                <span>
                  {item.icao}
                  {item.cidade ? ` · ${item.cidade}` : ""}
                </span>
                <span className="tabular-nums">{formatLitros(item.litros)}</span>
                <span className="tabular-nums font-semibold">
                  {item.amount != null ? formatBRL(item.amount) : "—"}
                </span>
                {item.anexoUrl ? (
                  <a
                    href={item.anexoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-tse-olive hover:underline"
                  >
                    Ref. {item.referencia}
                  </a>
                ) : (
                  <span>Ref. {item.referencia}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <AcoesRelatorio
        titulo="Relatório desta tela"
        texto="PDF e Excel com trechos e alocações manuais Vibra."
        gerar={() => relatorioConferenciaVibra(months, aircraftId, dados, linhas)}
        gerarPdf={() =>
          baixarPdfConferenciaVibra({ months, aircraftId, dados, linhas })
        }
      />

      {selecionados.size > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 sm:p-5">
          <div className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-tse-border bg-white px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">
                Seleção
              </p>
              <p className="text-[13px]">
                <span className="font-semibold tabular-nums">{selecionados.size}</span>{" "}
                trecho(s) ·{" "}
                <span className="font-semibold tabular-nums">
                  {formatLitros(litrosSelecionados)}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={cancelarSelecao}
              className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-tse-muted hover:text-tse-text"
            >
              Cancelar
            </button>
            {selecaoTemAlocacao ? (
              <button
                type="button"
                onClick={limparSelecaoAlocada}
                className="rounded-lg border border-[#E8D5C4] bg-[#FFFBF5] px-3 py-1.5 text-[12px] font-semibold text-[#8B5E3C] hover:border-[#C9A227]"
              >
                Desfazer alocação
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setAvisoAlocacao(null);
                setModalAlocar(true);
              }}
              className="rounded-full bg-tse-olive px-4 py-2 text-[13px] font-bold text-tse-text hover:bg-tse-yellow-strong"
            >
              Escolher NF
            </button>
          </div>
        </div>
      ) : null}

      {modalAlocar && selecionados.size > 0 ? (
        <ModalAlocarNf
          tituloId={tituloModalId}
          qtd={selecionados.size}
          litros={litrosSelecionados}
          notas={notasProximas}
          aviso={avisoAlocacao}
          onClose={() => {
            setAvisoAlocacao(null);
            setModalAlocar(false);
          }}
          onAlocar={alocarNota}
        />
      ) : null}
    </PageStack>
  );
}

function ModalAlocarNf({
  tituloId,
  qtd,
  litros,
  notas,
  aviso,
  onClose,
  onAlocar,
}: {
  tituloId: string;
  qtd: number;
  litros: number;
  notas: NotaVibraProxima[];
  aviso: string | null;
  onClose: () => void;
  onAlocar: (abastecimentoId: string) => void;
}) {
  const compativeis = notas.filter((nota) => nota.origemCompativel);
  const bloqueadas = notas.filter((nota) => !nota.origemCompativel);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal
        aria-labelledby={tituloId}
        className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-tse-line px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">
              Alocar comprovante
            </p>
            <h2 id={tituloId} className="mt-1 text-[18px] font-bold tracking-tight">
              Escolher NF Vibra
            </h2>
            <p className="mt-1 text-[13px] text-tse-muted">
              <span className="font-semibold tabular-nums text-tse-text">{qtd}</span> trecho(s)
              {" · consumo est. "}
              <span className="font-semibold tabular-nums text-tse-text">
                {formatLitros(litros)}
              </span>
            </p>
            <p className="mt-1 text-[12px] text-tse-muted">
              O 1º trecho precisa partir do aeroporto do abastecimento; os seguintes usam o saldo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-tse-muted hover:bg-tse-bg"
            aria-label="Fechar"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {aviso ? (
            <p className="mb-3 rounded-xl border border-[#F5E6D3] bg-[#FFFBF5] px-3 py-2 text-[13px] text-[#8B5E3C]">
              {aviso}
            </p>
          ) : null}

          {notas.length === 0 ? (
            <p className="rounded-xl border border-dashed border-tse-border px-4 py-8 text-center text-[13px] text-tse-muted">
              Nenhuma NF Vibra a ±7 dias dos trechos selecionados neste recorte.
            </p>
          ) : (
            <div className="space-y-4">
              {compativeis.length === 0 ? (
                <p className="rounded-xl border border-[#F5E6D3] bg-[#FFFBF5] px-3 py-3 text-[13px] text-[#8B5E3C]">
                  Nenhuma NF compatível com a origem do 1º trecho. Inclua o trecho que parte do
                  aeroporto do abastecimento, ou use saldo de uma NF já iniciada nesse aeroporto.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {compativeis.map((nota) => (
                    <li key={nota.abastecimentoId}>
                      <button
                        type="button"
                        onClick={() => onAlocar(nota.abastecimentoId)}
                        className={cn(
                          "w-full rounded-xl border bg-white px-3 py-3 text-left transition hover:border-tse-gold hover:bg-tse-soft/50",
                          nota.mesmoIcao ? "border-tse-yellow" : "border-tse-border",
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="font-semibold">
                            Ref. {nota.referencia}
                            <span className="ml-2 text-[11px] font-bold text-tse-gold">
                              origem ok
                            </span>
                          </p>
                          <p className="text-[11px] text-tse-muted tabular-nums">
                            {nota.deltaDiasMin === 0
                              ? "mesmo dia"
                              : `Δ ${nota.deltaDiasMin}d`}
                          </p>
                        </div>
                        <p className="mt-1 text-[12px] text-tse-muted">
                          {formatDate(nota.date)} · {nota.icao}
                          {nota.cidade ? ` · ${nota.cidade}` : ""}
                        </p>
                        <p className="mt-1 text-[13px] tabular-nums">
                          <span className="font-semibold">{formatLitros(nota.litros)}</span>
                          {nota.amount != null ? (
                            <>
                              {" · "}
                              <span className="font-semibold">{formatBRL(nota.amount)}</span>
                              <span className="text-tse-muted">
                                {" "}
                                ({formatPrecoLitro(nota.precoLitro)})
                              </span>
                            </>
                          ) : null}
                        </p>
                        {nota.trechosJaAlocados > 0 ? (
                          <p className="mt-1 text-[11px] text-tse-muted">
                            Já em {nota.trechosJaAlocados} trecho(s) · consumo{" "}
                            {formatLitros(nota.litrosConsumoAlocados)}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] font-semibold text-tse-gold">
                            Clique para alocar
                          </p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {bloqueadas.length > 0 ? (
                <div>
                  <p className="mb-2 text-[11px] font-bold tracking-wide text-tse-muted uppercase">
                    Bloqueadas · origem diferente do abast.
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {bloqueadas.map((nota) => (
                      <li
                        key={nota.abastecimentoId}
                        className="rounded-xl border border-tse-border bg-[#F7F8F9] px-3 py-3 opacity-80"
                      >
                        <p className="font-semibold text-tse-muted">
                          Ref. {nota.referencia}
                          <span className="ml-2 text-[11px] font-bold">origem ≠ NF</span>
                        </p>
                        <p className="mt-1 text-[12px] text-tse-muted">
                          {formatDate(nota.date)} · {nota.icao}
                          {nota.cidade ? ` · ${nota.cidade}` : ""}
                          {" · "}
                          {formatLitros(nota.litros)}
                        </p>
                        {nota.motivoIncompativel ? (
                          <p className="mt-1 text-[11px] text-[#8B5E3C]">{nota.motivoIncompativel}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
