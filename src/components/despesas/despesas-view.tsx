"use client";

import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  BadgeCheck,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  Fuel,
  Home,
  Plus,
  Receipt,
  Shield,
  SlidersHorizontal,
  UtensilsCrossed,
  Users,
  Warehouse,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
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
import { cn, formatBRL, formatDate, formatDateLista, formatDateShort } from "@/lib/format";
import { CATEGORY_LABEL, categoryBarColor, POSTING_LABEL } from "@/lib/labels";
import {
  custosDoSocio,
  custosPorCategoria,
  expensesIn,
  getAircraft,
  getItinerary,
  getKpis,
  hrefOrigem,
  listNotasFiscais,
  monthsLabel,
  partnerName,
  valorDoParceiro,
} from "@/services/operacao";
import { relatorioDespesas } from "@/services/relatorios-operacao";
import type { Expense, ExpenseCategory, NotaFiscal } from "@/types/operacao";

const ICONE_CATEGORIA: Record<ExpenseCategory, LucideIcon> = {
  combustivel: Fuel,
  taxas: Receipt,
  handling: Warehouse,
  catering: UtensilsCrossed,
  hangar: Home,
  seguro: Shield,
  tripulacao: Users,
  administrativo: Briefcase,
  manutencao: Wrench,
};

type ColunaDespesa =
  | "data"
  | "lancamento"
  | "aeronave"
  | "natureza"
  | "socio"
  | "situacao"
  | "valor";

type ColunaNf = "data" | "nf" | "fornecedor" | "descricao" | "valor";

type Ordem = "asc" | "desc";

type Ordenacao<T extends string> = { coluna: T; ordem: Ordem };

type Recorte = "todas" | "voo" | "estrutura" | "manutencao" | "nf";

const ABAS: { id: Recorte; label: string }[] = [
  { id: "todas", label: "Tudo" },
  { id: "voo", label: "Voos" },
  { id: "estrutura", label: "Estrutura" },
  { id: "manutencao", label: "Manutenção" },
  { id: "nf", label: "NF" },
];

function passaRecorte(expense: Expense, recorte: Recorte): boolean {
  if (recorte === "todas" || recorte === "nf") return true;
  if (recorte === "manutencao") return expense.category === "manutencao";
  if (recorte === "voo") return expense.allocation === "solicitante";
  return expense.allocation === "participacao" && expense.category !== "manutencao";
}

function rotuloSocio(expense: Expense): string {
  if (expense.partnerId) return partnerName(expense.partnerId);
  if (expense.itineraryId) {
    const trip = getItinerary(expense.itineraryId);
    if (trip?.requestedBy) return partnerName(trip.requestedBy);
  }
  return "Despesa sem identificação do sócio";
}

function tituloCurto(expense: Expense): string {
  const parte = expense.description.split(" · ")[0]?.trim();
  return parte && parte.length > 0 ? parte : CATEGORY_LABEL[expense.category];
}

function trajetoDaDespesa(expense: Expense): string | null {
  if (expense.itineraryId) {
    const trip = getItinerary(expense.itineraryId);
    const leg = expense.legId
      ? trip?.legs.find((item) => item.id === expense.legId)
      : trip?.legs[0];
    if (leg) return `${leg.fromCity} → ${leg.toCity}`;
  }
  const seta = expense.description.match(
    /·\s*(.+?\(.+?\))\s*→\s*(.+?\(.+?\))/,
  );
  if (seta?.[1] && seta[2]) {
    return `${seta[1].replace(/\s*\([^)]+\)/g, "").trim()} → ${seta[2]
      .replace(/\s*\([^)]+\)/g, "")
      .trim()}`;
  }
  const pouso = expense.description.match(/Tarifa de pouso\s+[A-Z0-9]{4}\s*·\s*[A-Z0-9]{4}→([A-Z0-9]{4})/i);
  if (pouso?.[1] && expense.itineraryId) {
    const trip = getItinerary(expense.itineraryId);
    const leg = trip?.legs.find((item) => item.toIcao === pouso[1] || item.fromIcao === pouso[1]);
    if (leg) return leg.toCity;
  }
  return null;
}

function notaDaDespesa(expense: Expense, notas: NotaFiscal[]): NotaFiscal | null {
  const doc = expense.description.match(/doc\s+(\d+)/i)?.[1];
  if (!doc) return null;
  return (
    notas.find((item) => item.numero === doc || item.numero.replace(/^0+/, "") === doc.replace(/^0+/, "")) ??
    null
  );
}

function tipoRecorte(expense: Expense): string {
  if (expense.allocation === "solicitante") return "Voo";
  if (expense.category === "manutencao") return "Manutenção";
  return "Estrutura";
}

function socioDaDespesa(expense: Expense): string | null {
  if (expense.partnerId) return expense.partnerId;
  if (expense.itineraryId) {
    return getItinerary(expense.itineraryId)?.requestedBy ?? null;
  }
  return null;
}

function passaSocio(expense: Expense, socioFiltro: string): boolean {
  if (socioFiltro === "todos") return true;
  if (socioFiltro === "sem") {
    return socioDaDespesa(expense) === null && expense.allocation !== "participacao";
  }
  return valorDoParceiro(expense, socioFiltro) > 0;
}

function valorExibido(expense: Expense, socioFiltro: string): number {
  if (socioFiltro === "todos" || socioFiltro === "sem") return expense.amount;
  return valorDoParceiro(expense, socioFiltro);
}

function compararTexto(left: string, right: string, ordem: Ordem): number {
  const cmp = left.localeCompare(right, "pt-BR", { sensitivity: "base" });
  return ordem === "asc" ? cmp : -cmp;
}

function compararNumero(left: number, right: number, ordem: Ordem): number {
  return ordem === "asc" ? left - right : right - left;
}

function ordenarDespesas(
  itens: Expense[],
  ordenacao: Ordenacao<ColunaDespesa>,
  socioFiltro: string,
): Expense[] {
  const { coluna, ordem } = ordenacao;
  return [...itens].sort((left, right) => {
    switch (coluna) {
      case "data":
        return (
          compararTexto(left.date, right.date, ordem) ||
          compararNumero(valorExibido(left, socioFiltro), valorExibido(right, socioFiltro), "desc")
        );
      case "lancamento":
        return compararTexto(left.description, right.description, ordem);
      case "aeronave":
        return compararTexto(
          getAircraft(left.aircraftId)?.registration ?? left.aircraftId,
          getAircraft(right.aircraftId)?.registration ?? right.aircraftId,
          ordem,
        );
      case "natureza":
        return compararTexto(CATEGORY_LABEL[left.category], CATEGORY_LABEL[right.category], ordem);
      case "socio":
        return compararTexto(rotuloSocio(left), rotuloSocio(right), ordem);
      case "situacao":
        return compararTexto(POSTING_LABEL[left.posting], POSTING_LABEL[right.posting], ordem);
      case "valor":
        return compararNumero(
          valorExibido(left, socioFiltro),
          valorExibido(right, socioFiltro),
          ordem,
        );
      default:
        return 0;
    }
  });
}

function ordenarNotas(itens: NotaFiscal[], ordenacao: Ordenacao<ColunaNf>): NotaFiscal[] {
  const { coluna, ordem } = ordenacao;
  return [...itens].sort((left, right) => {
    switch (coluna) {
      case "data":
        return compararTexto(left.date, right.date, ordem);
      case "nf":
        return compararTexto(left.numero, right.numero, ordem);
      case "fornecedor":
        return compararTexto(left.fornecedor, right.fornecedor, ordem);
      case "descricao":
        return compararTexto(left.descricao, right.descricao, ordem);
      case "valor":
        return compararNumero(left.amount, right.amount, ordem);
      default:
        return 0;
    }
  });
}

function CabecalhoOrdenavel<T extends string>({
  coluna,
  atual,
  onOrdenar,
  children,
  className,
}: {
  coluna: T;
  atual: Ordenacao<T>;
  onOrdenar: (coluna: T) => void;
  children: ReactNode;
  className?: string;
}) {
  const ativo = atual.coluna === coluna;
  const Icone = !ativo ? ArrowUpDown : atual.ordem === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={cn(thClass, className)}>
      <button
        type="button"
        onClick={() => onOrdenar(coluna)}
        className="inline-flex items-center gap-1 font-bold tracking-wide uppercase"
        aria-sort={ativo ? (atual.ordem === "asc" ? "ascending" : "descending") : "none"}
      >
        {children}
        <Icone className={cn("size-3.5", ativo ? "text-tse-olive" : "text-tse-muted")} aria-hidden />
      </button>
    </th>
  );
}

export function DespesasView() {
  useDados();
  const { aircraftId, months, partnerId } = useOperacao();
  const [recorte, setRecorte] = useState<Recorte>("todas");
  const [naturezaAberta, setNaturezaAberta] = useState<boolean>(true);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [filtroSocio, setFiltroSocio] = useState<string>(partnerId ?? "todos");
  const [ordenacao, setOrdenacao] = useState<Ordenacao<ColunaDespesa>>({
    coluna: "data",
    ordem: "desc",
  });
  const [ordenacaoNf, setOrdenacaoNf] = useState<Ordenacao<ColunaNf>>({
    coluna: "data",
    ordem: "desc",
  });
  const socioAtivo = partnerId ?? filtroSocio;
  const socioEspecifico = socioAtivo !== "todos" && socioAtivo !== "sem";
  const kpisGerais = getKpis(months, aircraftId);
  const fatiaSocio = socioEspecifico ? custosDoSocio(months, aircraftId, socioAtivo) : null;
  const totalDespesas = fatiaSocio?.total ?? kpisGerais.custoComprometido;
  const totalFaturado = fatiaSocio?.realizado ?? kpisGerais.custoRealizado;
  const categorias = fatiaSocio?.categorias ?? custosPorCategoria(months, aircraftId);
  const maior = categorias[0]?.amount ?? 1;
  const notas = listNotasFiscais(months, aircraftId);
  const faltaFaturar = Math.max(0, totalDespesas - totalFaturado);
  const rows = ordenarDespesas(
    expensesIn(months, aircraftId)
      .filter((item) => passaRecorte(item, recorte))
      .filter((item) => passaSocio(item, socioAtivo)),
    ordenacao,
    socioAtivo,
  );
  const abaNf = recorte === "nf";
  const detalhe = detalheId ? rows.find((item) => item.id === detalheId) ?? null : null;
  const semComprovante = expensesIn(months, aircraftId).filter(
    (item) =>
      item.posting === "realizado" &&
      !notaDaDespesa(item, notas) &&
      passaSocio(item, socioAtivo),
  );
  // Biblioteca de comprovantes do período/aeronave (arquivo local, não tabela no banco).
  // Sócio vê as mesmas NFs do recorte; o vínculo por "doc" só aparece no detalhe do lançamento.
  const notasFiltradas = ordenarNotas(notas, ordenacaoNf);

  function alternarOrdenacao(coluna: ColunaDespesa) {
    setOrdenacao((atual) =>
      atual.coluna === coluna
        ? { coluna, ordem: atual.ordem === "asc" ? "desc" : "asc" }
        : { coluna, ordem: coluna === "valor" || coluna === "data" ? "desc" : "asc" },
    );
  }

  function alternarOrdenacaoNf(coluna: ColunaNf) {
    setOrdenacaoNf((atual) =>
      atual.coluna === coluna
        ? { coluna, ordem: atual.ordem === "asc" ? "desc" : "asc" }
        : { coluna, ordem: coluna === "valor" || coluna === "data" ? "desc" : "asc" },
    );
  }

  const propsSocio = partnerId
    ? undefined
    : { socioId: filtroSocio, onSocioChange: setFiltroSocio };
  const craftAtiva = aircraftId !== "todas" ? getAircraft(aircraftId) : null;
  const contextoPeriodo = [
    craftAtiva?.registration ?? (aircraftId === "todas" ? "Toda a operação" : aircraftId),
    monthsLabel(months),
  ].join(" · ");

  function alternarFiltroRapido() {
    setOrdenacao((atual) =>
      atual.coluna === "valor"
        ? { coluna: "data", ordem: "desc" }
        : { coluna: "valor", ordem: "desc" },
    );
  }

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
            <h1 className="text-[22px] font-bold tracking-tight">Minhas despesas</h1>
            <p className="mt-0.5 text-[13px] text-tse-muted">{contextoPeriodo}</p>
          </div>
        </div>
      ) : null}

      <div className="md:hidden">
        <FiltrosOperacao compacto {...propsSocio} />
      </div>
      <div className="hidden md:block">
        <FiltrosOperacao
          legenda="O período altera totais, natureza e lançamentos."
          {...propsSocio}
        />
      </div>

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">
          {socioEspecifico ? "Minha parte no período" : "Despesas do período"}
        </p>
        <p className="mt-1 text-[32px] leading-none font-bold tracking-tight tabular-nums sm:text-[36px]">
          {formatBRL(totalDespesas)}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[#EEEEEE] pt-4 text-[13px]">
          <div className="flex items-start gap-2">
            <BadgeCheck className="mt-0.5 size-4 shrink-0 text-[#16A34A]" aria-hidden />
            <div>
              <dt className="text-tse-muted">Faturadas</dt>
              <dd className="mt-0.5 text-[18px] font-bold tabular-nums">{formatBRL(totalFaturado)}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock3 className="mt-0.5 size-4 shrink-0 text-tse-olive" aria-hidden />
            <div>
              <dt className="text-tse-muted">A faturar</dt>
              <dd className="mt-0.5 text-[18px] font-bold tabular-nums">{formatBRL(faltaFaturar)}</dd>
            </div>
          </div>
        </dl>
        {!abaNf ? (
          <div className="mt-3 border-t border-[#EEEEEE] pt-2">
            <button
              type="button"
              aria-expanded={naturezaAberta}
              onClick={() => setNaturezaAberta((atual) => !atual)}
              className="flex w-full items-center justify-between gap-3 py-2 text-left"
            >
              <span className="text-[13px] font-bold">Por natureza</span>
              <ChevronDown
                className={cn(
                  "size-4 text-tse-muted transition-transform",
                  naturezaAberta && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            {naturezaAberta ? (
              <ul className="space-y-3.5 pb-1">
                {categorias.map((item) => {
                  const Icone = ICONE_CATEGORIA[item.category];
                  const pct = totalDespesas > 0 ? (item.amount / totalDespesas) * 100 : 0;
                  return (
                    <li key={item.category} className="text-[13px]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2 font-medium">
                          <Icone className="size-3.5 shrink-0 text-tse-olive" aria-hidden />
                          <span className="truncate">{CATEGORY_LABEL[item.category]}</span>
                        </span>
                        <span className="shrink-0 font-bold tabular-nums">
                          {formatBRL(item.amount)}
                          <span className="ml-1.5 text-[11px] font-semibold text-tse-muted">
                            {pct.toLocaleString("pt-BR", {
                              maximumFractionDigits: 1,
                              minimumFractionDigits: pct >= 10 ? 0 : 1,
                            })}
                            %
                          </span>
                        </span>
                      </div>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-tse-bg">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.max(4, (item.amount / maior) * 100)}%`,
                            background: categoryBarColor(item.category),
                          }}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-bold">Lançamentos</h2>
        <Link
          href="/despesas/nova"
          className="inline-flex size-9 items-center justify-center rounded-full bg-tse-text text-white md:hidden"
          aria-label="Nova despesa"
        >
          <Plus className="size-4" aria-hidden />
        </Link>
        <Link
          href="/despesas/nova"
          className="hidden items-center gap-1 text-[13px] font-bold text-tse-olive md:inline-flex"
        >
          <Plus className="size-4" aria-hidden />
          Nova despesa
        </Link>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 pb-3">
          {ABAS.map((aba) => (
            <button
              key={aba.id}
              type="button"
              aria-pressed={recorte === aba.id}
              onClick={() => setRecorte(aba.id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] font-bold whitespace-nowrap",
                recorte === aba.id
                  ? "bg-tse-text text-white"
                  : "border border-[#EEF0F3] bg-white text-tse-muted",
              )}
            >
              {aba.label}
            </button>
          ))}
        </div>
      </div>

      {abaNf ? (
        <BibliotecaNf
          notas={notasFiltradas}
          ordenacao={ordenacaoNf}
          onOrdenar={alternarOrdenacaoNf}
          semComprovante={partnerId ? [] : semComprovante}
          mostrarSem={!partnerId}
        />
      ) : rows.length === 0 ? (
        <EmptyState>Nenhuma despesa neste recorte.</EmptyState>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-tse-muted">{rows.length} lançamentos</p>
            <button
              type="button"
              onClick={alternarFiltroRapido}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#EEF0F3] bg-white px-3 py-1.5 text-[12px] font-bold text-tse-olive"
              aria-label="Alternar ordenação dos lançamentos"
            >
              <SlidersHorizontal className="size-3.5" aria-hidden />
              Filtrar
            </button>
          </div>

          {/* Mobile: lista compacta */}
          <section className="overflow-hidden rounded-2xl border border-[#EEF0F3] bg-white shadow-sm md:hidden">
            <ul className="divide-y divide-[#EEEEEE]">
              {rows.map((item) => {
                const trajeto = trajetoDaDespesa(item);
                const Icone = ICONE_CATEGORIA[item.category];
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setDetalheId(item.id)}
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
                    >
                      <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-tse-olive">
                        <Icone className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[15px] font-bold">
                            {CATEGORY_LABEL[item.category]}
                          </span>
                          <span className="shrink-0 text-[15px] font-bold tabular-nums">
                            {formatBRL(valorExibido(item, socioAtivo))}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[12px] text-tse-muted">
                          {formatDateLista(item.date)}
                          {trajeto ? ` · ${trajeto}` : ""}
                        </span>
                        <span className="block text-[12px] text-tse-muted">{item.vendor}</span>
                      </span>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-tse-muted" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Desktop: tabela */}
          <div className="hidden md:block">
            <TableWrap>
              <table className={tableClass}>
                <thead className={theadClass}>
                  <tr>
                    <CabecalhoOrdenavel coluna="data" atual={ordenacao} onOrdenar={alternarOrdenacao}>
                      Data
                    </CabecalhoOrdenavel>
                    <CabecalhoOrdenavel coluna="lancamento" atual={ordenacao} onOrdenar={alternarOrdenacao}>
                      Lançamento
                    </CabecalhoOrdenavel>
                    <CabecalhoOrdenavel coluna="aeronave" atual={ordenacao} onOrdenar={alternarOrdenacao}>
                      Aeronave
                    </CabecalhoOrdenavel>
                    <CabecalhoOrdenavel coluna="natureza" atual={ordenacao} onOrdenar={alternarOrdenacao}>
                      Natureza
                    </CabecalhoOrdenavel>
                    <CabecalhoOrdenavel coluna="socio" atual={ordenacao} onOrdenar={alternarOrdenacao}>
                      Sócio
                    </CabecalhoOrdenavel>
                    <CabecalhoOrdenavel coluna="situacao" atual={ordenacao} onOrdenar={alternarOrdenacao}>
                      Situação
                    </CabecalhoOrdenavel>
                    <CabecalhoOrdenavel coluna="valor" atual={ordenacao} onOrdenar={alternarOrdenacao}>
                      Valor
                    </CabecalhoOrdenavel>
                    <th className={thClass}>Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => {
                    const craft = getAircraft(item.aircraftId);
                    return (
                      <tr
                        key={item.id}
                        className={cn(trClass, "cursor-pointer")}
                        onClick={() => setDetalheId(item.id)}
                      >
                        <td className={tdClass}>{formatDateShort(item.date)}</td>
                        <td className={tdClass}>
                          <span className="font-bold">{item.description}</span>
                          <span className="block text-[12px] text-tse-muted">{item.vendor}</span>
                        </td>
                        <td className={tdClass}>{craft?.registration}</td>
                        <td className={tdClass}>{CATEGORY_LABEL[item.category]}</td>
                        <td className={tdClass}>{rotuloSocio(item)}</td>
                        <td className={tdClass}>
                          <StatusBadge value={item.posting} />
                        </td>
                        <td className={`${tdClass} font-bold`}>
                          {formatBRL(valorExibido(item, socioAtivo))}
                        </td>
                        <td className={tdClass}>
                          <Link
                            href={hrefOrigem(item)}
                            onClick={(event) => event.stopPropagation()}
                            className="text-[12px] font-bold tracking-wide text-tse-olive uppercase hover:underline"
                          >
                            {item.manual ? "Editar" : "Abrir"}
                          </Link>
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
        titulo="Relatório de despesas"
        texto={
          socioEspecifico
            ? "Baixa a sua parte, a natureza e os lançamentos deste período em PDF ou Excel."
            : "Baixa totais, natureza, lançamentos e NFs do recorte atual em PDF ou Excel."
        }
        gerar={() => relatorioDespesas(months, aircraftId, socioAtivo)}
      />

      {detalhe ? (
        <DetalheDespesa
          expense={detalhe}
          valor={valorExibido(detalhe, socioAtivo)}
          nota={notaDaDespesa(detalhe, notas)}
          onClose={() => setDetalheId(null)}
        />
      ) : null}
    </PageStack>
  );
}

function BibliotecaNf({
  notas,
  ordenacao,
  onOrdenar,
  semComprovante,
  mostrarSem,
}: {
  notas: NotaFiscal[];
  ordenacao: Ordenacao<ColunaNf>;
  onOrdenar: (coluna: ColunaNf) => void;
  semComprovante: Expense[];
  mostrarSem: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="border-b border-[#EEEEEE] px-4 py-3">
        <p className="text-[14px] font-bold">Comprovantes</p>
        <p className="text-[12px] text-tse-muted">
          Biblioteca de NF e demonstrativos vinculados às despesas.
        </p>
      </div>
      {notas.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-tse-muted">Nenhum comprovante neste recorte.</p>
      ) : (
        <>
          <ul className="divide-y divide-[#EEEEEE] md:hidden">
            {notas.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3.5">
                <FileText className="mt-0.5 size-4 shrink-0 text-tse-olive" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-bold">{item.numero}</span>
                    <span className="shrink-0 font-bold">{formatBRL(item.amount)}</span>
                  </span>
                  <span className="mt-0.5 block text-[12px] text-tse-muted">
                    {formatDateShort(item.date)} · {item.fornecedor}
                  </span>
                  <span className="block text-[12px] text-tse-muted">{item.descricao}</span>
                </span>
                {item.anexoUrl ? (
                  <a
                    href={item.anexoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[12px] font-bold tracking-wide text-tse-olive uppercase"
                  >
                    Ver
                  </a>
                ) : (
                  <span className="shrink-0 text-[12px] text-tse-muted">Sem arquivo</span>
                )}
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  <CabecalhoOrdenavel coluna="data" atual={ordenacao} onOrdenar={onOrdenar}>
                    Data
                  </CabecalhoOrdenavel>
                  <CabecalhoOrdenavel coluna="nf" atual={ordenacao} onOrdenar={onOrdenar}>
                    NF
                  </CabecalhoOrdenavel>
                  <CabecalhoOrdenavel coluna="fornecedor" atual={ordenacao} onOrdenar={onOrdenar}>
                    Fornecedor
                  </CabecalhoOrdenavel>
                  <CabecalhoOrdenavel coluna="descricao" atual={ordenacao} onOrdenar={onOrdenar}>
                    Descrição
                  </CabecalhoOrdenavel>
                  <CabecalhoOrdenavel coluna="valor" atual={ordenacao} onOrdenar={onOrdenar}>
                    Valor
                  </CabecalhoOrdenavel>
                  <th className={thClass}>Anexo</th>
                </tr>
              </thead>
              <tbody>
                {notas.map((item) => (
                  <tr key={item.id} className={trClass}>
                    <td className={tdClass}>{formatDateShort(item.date)}</td>
                    <td className={`${tdClass} font-bold`}>{item.numero}</td>
                    <td className={tdClass}>{item.fornecedor}</td>
                    <td className={tdClass}>{item.descricao}</td>
                    <td className={`${tdClass} font-bold`}>{formatBRL(item.amount)}</td>
                    <td className={tdClass}>
                      {item.anexoUrl ? (
                        <a
                          href={item.anexoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] font-bold tracking-wide text-tse-olive uppercase hover:underline"
                        >
                          Ver
                        </a>
                      ) : (
                        <span className="text-[12px] text-tse-muted">Sem arquivo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {mostrarSem && semComprovante.length > 0 ? (
        <div className="border-t border-[#EEEEEE] px-4 py-3">
          <p className="text-[13px] font-bold text-[#C2410C]">
            {semComprovante.length} despesa(s) sem comprovante
          </p>
          <p className="mt-1 text-[12px] text-tse-muted">
            Lançamentos realizados sem NF vinculada no período.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function DetalheDespesa({
  expense,
  valor,
  nota,
  onClose,
}: {
  expense: Expense;
  valor: number;
  nota: NotaFiscal | null;
  onClose: () => void;
}) {
  const tituloId = useId();
  const craft = getAircraft(expense.aircraftId);
  const trajeto = trajetoDaDespesa(expense);

  useEffect(() => {
    function tecla(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", tecla);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = anterior;
    };
  }, [onClose]);

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
        className="relative z-10 max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={tituloId} className="text-[20px] font-bold">
                {tituloCurto(expense)}
              </h2>
              <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-bold text-[#334155]">
                {tipoRecorte(expense)}
              </span>
            </div>
            <p className="mt-3 text-[11px] font-bold tracking-wide text-tse-muted uppercase">
              {valor !== expense.amount ? "Sua parte" : "Valor da despesa"}
            </p>
            <p className="mt-1 text-[28px] font-bold tracking-tight">{formatBRL(valor)}</p>
            {valor !== expense.amount ? (
              <p className="mt-1 text-[12px] text-tse-muted">
                Lançamento integral {formatBRL(expense.amount)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-tse-muted hover:bg-tse-bg"
            aria-label="Fechar detalhe"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <dl className="mt-5 divide-y divide-[#EEEEEE] border-y border-[#EEEEEE] text-[14px]">
          <LinhaDetalhe rotulo="Data" valor={formatDate(expense.date)} />
          {trajeto ? <LinhaDetalhe rotulo="Trajeto" valor={trajeto} /> : null}
          <LinhaDetalhe rotulo="Fornecedor" valor={expense.vendor} />
          <LinhaDetalhe rotulo="Aeronave" valor={craft?.registration ?? expense.aircraftId} />
          <LinhaDetalhe rotulo="Natureza" valor={CATEGORY_LABEL[expense.category]} />
          <LinhaDetalhe rotulo="Situação" valor={<StatusBadge value={expense.posting} />} />
          <LinhaDetalhe rotulo="Sócio" valor={rotuloSocio(expense)} />
        </dl>

        <div className="mt-2 divide-y divide-[#EEEEEE]">
          <Link
            href="/rateio"
            className="flex items-center justify-between gap-3 py-3.5"
          >
            <span>
              <span className="block text-[14px] font-bold">Rateio</span>
              <span className="text-[12px] text-tse-muted">Ver responsáveis e parcelas</span>
            </span>
            <ChevronRight className="size-4 text-tse-muted" aria-hidden />
          </Link>
          {nota?.anexoUrl ? (
            <a
              href={nota.anexoUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 py-3.5"
            >
              <span>
                <span className="block text-[14px] font-bold">Nota fiscal / comprovante</span>
                <span className="text-[12px] text-tse-muted">
                  {nota.numero} · arquivo vinculado
                </span>
              </span>
              <FileText className="size-4 text-tse-olive" aria-hidden />
            </a>
          ) : (
            <div className="flex items-center justify-between gap-3 py-3.5">
              <span>
                <span className="block text-[14px] font-bold">Nota fiscal / comprovante</span>
                <span className="text-[12px] text-tse-muted">Sem arquivo vinculado</span>
              </span>
            </div>
          )}
          <Link
            href={hrefOrigem(expense)}
            className="flex items-center justify-between gap-3 py-3.5"
          >
            <span>
              <span className="block text-[14px] font-bold">
                {expense.manual ? "Editar lançamento" : "Abrir origem"}
              </span>
              <span className="text-[12px] text-tse-muted">{expense.description}</span>
            </span>
            <ChevronRight className="size-4 text-tse-muted" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}

function LinhaDetalhe({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <dt className="text-tse-muted">{rotulo}</dt>
      <dd className="text-right font-semibold">{valor}</dd>
    </div>
  );
}
