"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Users,
} from "lucide-react";
import { RelatoriosRateio } from "@/components/rateio/relatorios-rateio";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import { PageStack } from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { cn, formatBRL, formatDateShort, formatMil } from "@/lib/format";
import { CATEGORY_LABEL, corDoSocio } from "@/lib/labels";
import {
  contaCorrente,
  expensesIn,
  getAircraft,
  getItinerary,
  getRateio,
  itinerariesIn,
  listAportes,
  monthsLabel,
  partnerShort,
  type MonthFilter,
} from "@/services/operacao";
import type { Expense, ExpenseCategory, RateioPartner } from "@/types/operacao";

type GrupoDespesa = {
  id: string;
  titulo: string;
  categorias: ExpenseCategory[];
};

const GRUPOS: GrupoDespesa[] = [
  {
    id: "voo",
    titulo: "Combustível e taxas",
    categorias: ["combustivel", "taxas", "handling", "catering"],
  },
  {
    id: "estrutura",
    titulo: "Hangar e seguro",
    categorias: ["hangar", "seguro", "tripulacao", "administrativo"],
  },
  {
    id: "manutencao",
    titulo: "Manutenção",
    categorias: ["manutencao"],
  },
];

export function RateioView() {
  useDados();
  const { aircraftId, months, partnerId } = useOperacao();
  const rateio = getRateio(months, aircraftId);
  const eu = partnerId
    ? rateio.partners.find((item) => item.partnerId === partnerId)
    : undefined;
  const pendentes = despesasPendentesRateio(months, aircraftId);
  const valorPendente = pendentes.reduce((soma, item) => soma + item.amount, 0);
  const distribuido = Math.max(0, rateio.total - valorPendente);

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
            <h1 className="text-[22px] font-bold tracking-tight">Minha conta</h1>
            <p className="mt-0.5 text-[13px] text-tse-muted">{contextoPeriodo}</p>
          </div>
        </div>
      ) : (
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight">Rateio</h1>
          <p className="mt-0.5 text-[13px] text-tse-muted">{contextoPeriodo}</p>
        </div>
      )}

      <FiltrosOperacao
        compacto={Boolean(partnerId)}
        legenda={partnerId ? undefined : `Competência: ${monthsLabel(months).toLowerCase()}.`}
      />

      {eu ? (
        <RateioSocio eu={eu} months={months} aircraftId={aircraftId} />
      ) : (
        <RateioAdmin
          months={months}
          aircraftId={aircraftId}
          rateioTotal={rateio.total}
          distribuido={distribuido}
          valorPendente={valorPendente}
          pendentesCount={pendentes.length}
          partners={rateio.partners}
          expenses={expensesIn(months, aircraftId)}
        />
      )}
    </PageStack>
  );
}

function RateioSocio({
  eu,
  months,
  aircraftId,
}: {
  eu: RateioPartner;
  months: MonthFilter;
  aircraftId: string;
}) {
  const [abertos, setAbertos] = useState<string[]>(["voos"]);
  const falta = Math.max(0, eu.saldo);
  const voosPedidos = itinerariesIn(months, aircraftId).filter(
    (trip) => trip.requestedBy === eu.partnerId && trip.status !== "cancelado",
  );
  const comuns = expensesIn(months, aircraftId).filter(
    (item) => item.allocation === "participacao",
  );
  const conta = contaCorrente(eu.partnerId, months, aircraftId);
  const ultimos = [...conta.lancamentos].reverse().slice(0, 6);
  const aportes = listAportes(months).filter(
    (item) =>
      item.partnerId === eu.partnerId &&
      (aircraftId === "todas" || item.aircraftId === null || item.aircraftId === aircraftId),
  );

  function alternar(id: string) {
    setAbertos((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id],
    );
  }

  return (
    <>
      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-tse-muted">Falta pagar neste período</p>
            <p className="mt-1 text-[34px] leading-none font-bold tracking-tight tabular-nums">
              {formatBRL(falta)}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase",
              falta > 1
                ? "bg-[#FFEDD5] text-[#C2410C]"
                : "bg-[#F1F5F9] text-[#334155]",
            )}
          >
            {falta > 1 ? "Em aberto" : "Em dia"}
          </span>
        </div>
        <dl className="mt-5 space-y-2.5 text-[14px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-tse-muted">
              <CircleDollarSign className="size-4 text-tse-olive" aria-hidden />
              Sua parte no período
            </dt>
            <dd className="font-bold tabular-nums">{formatBRL(eu.total)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-tse-muted">
              <CircleDollarSign className="size-4 text-[#16A34A]" aria-hidden />
              Você já pagou no período
            </dt>
            <dd className="font-bold text-[#15803D] tabular-nums">{formatBRL(eu.pago)}</dd>
          </div>
        </dl>
        <a
          href="#meus-pagamentos"
          className="mt-5 inline-flex items-center gap-1 text-[13px] font-bold text-tse-olive"
        >
          Ver meus pagamentos
          <ChevronRight className="size-4" aria-hidden />
        </a>
      </section>

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[16px] font-bold">
            De onde vieram os {formatBRL(eu.total)}?
          </h2>
          <FileText className="size-4 shrink-0 text-tse-muted" aria-hidden />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ResumoBloco
            titulo="Meus voos"
            valor={formatBRL(eu.voos)}
            detalhe={`${voosPedidos.length} ${voosPedidos.length === 1 ? "voo" : "voos"}`}
          />
          <ResumoBloco
            titulo="Despesas comuns"
            valor={formatBRL(eu.participacao)}
            detalhe={`${comuns.length} ${comuns.length === 1 ? "despesa" : "despesas"}`}
          />
        </div>

        <div className="mt-4 divide-y divide-[#EEEEEE] border-t border-[#EEEEEE]">
          <Acordeao
            aberto={abertos.includes("voos")}
            onToggle={() => alternar("voos")}
            titulo="Meus voos"
            subtitulo="Combustível, taxas e outros custos"
          >
            {eu.byCategory
              .filter((item) =>
                ["combustivel", "taxas", "handling", "catering"].includes(item.category),
              )
              .map((item) => (
                <Linha key={item.category} rotulo={CATEGORY_LABEL[item.category]} valor={formatBRL(item.amount)} />
              ))}
            {eu.voos <= 0 ? (
              <p className="text-[13px] text-tse-muted">Nenhum custo de voo neste recorte.</p>
            ) : null}
          </Acordeao>
          <Acordeao
            aberto={abertos.includes("comuns")}
            onToggle={() => alternar("comuns")}
            titulo="Despesas comuns"
            subtitulo="Hangar, seguro, manutenção…"
          >
            {eu.byCategory
              .filter(
                (item) =>
                  !["combustivel", "taxas", "handling", "catering"].includes(item.category),
              )
              .map((item) => (
                <Linha key={item.category} rotulo={CATEGORY_LABEL[item.category]} valor={formatBRL(item.amount)} />
              ))}
            {eu.participacao <= 0 ? (
              <p className="text-[13px] text-tse-muted">Nenhuma despesa comum neste recorte.</p>
            ) : null}
          </Acordeao>
        </div>
      </section>

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-bold">Últimos lançamentos</h2>
          <Link href="/despesas" className="text-[13px] font-bold text-tse-olive">
            Ver todos
          </Link>
        </div>
        {ultimos.length === 0 ? (
          <p className="mt-3 text-[13px] text-tse-muted">Nenhum lançamento nesta competência.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#EEEEEE]">
            {ultimos.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold">{item.historico}</span>
                  <span className="text-[12px] text-tse-muted">{formatDateShort(item.date)}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[14px] font-bold",
                    item.natureza === "credito" ? "text-[#15803D]" : "text-tse-text",
                  )}
                >
                  {item.natureza === "credito" ? "−" : ""}
                  {formatBRL(item.valor)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="meus-pagamentos" className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-bold">Meus pagamentos</h2>
          <Link
            href="/rateio/aportes/novo"
            className="text-[13px] font-bold text-tse-olive"
          >
            Novo aporte
          </Link>
        </div>
        {aportes.length === 0 ? (
          <p className="mt-3 text-[13px] text-tse-muted">Nenhum aporte nesta competência.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#EEEEEE]">
            {aportes.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold">
                    {item.note || item.reference || "Aporte"}
                  </span>
                  <span className="text-[12px] text-tse-muted">{formatDateShort(item.date)}</span>
                </span>
                <span className="shrink-0 text-[14px] font-bold text-[#15803D]">
                  {formatBRL(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function RateioAdmin({
  months,
  aircraftId,
  rateioTotal,
  distribuido,
  valorPendente,
  pendentesCount,
  partners,
  expenses,
}: {
  months: MonthFilter;
  aircraftId: string;
  rateioTotal: number;
  distribuido: number;
  valorPendente: number;
  pendentesCount: number;
  partners: RateioPartner[];
  expenses: Expense[];
}) {
  return (
    <>
      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">
          Resumo do período
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[11px] text-tse-muted">
              <CircleDollarSign className="size-3.5 shrink-0 text-tse-olive" aria-hidden />
              Despesas
            </p>
            <p className="mt-1 truncate text-[18px] font-bold tracking-tight tabular-nums sm:text-[20px]">
              {formatMil(rateioTotal)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[11px] text-tse-muted">
              <Users className="size-3.5 shrink-0 text-tse-olive" aria-hidden />
              Distribuídas
            </p>
            <p className="mt-1 truncate text-[18px] font-bold tracking-tight tabular-nums sm:text-[20px]">
              {formatMil(distribuido)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[11px] text-tse-muted">
              <CircleDollarSign className="size-3.5 shrink-0 text-[#EA580C]" aria-hidden />
              Sem rateio
            </p>
            <p
              className={cn(
                "mt-1 truncate text-[18px] font-bold tracking-tight tabular-nums sm:text-[20px]",
                valorPendente > 1 && "text-[#EA580C]",
              )}
            >
              {formatMil(valorPendente)}
            </p>
          </div>
        </div>
        <Link
          href="/despesas"
          className="mt-5 inline-flex items-center gap-1 text-[13px] font-bold text-tse-olive"
        >
          {pendentesCount > 0
            ? `Ver ${pendentesCount} despesa${pendentesCount === 1 ? "" : "s"} pendente${pendentesCount === 1 ? "" : "s"}`
            : "Ver despesas"}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </section>

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-[16px] font-bold">Despesas do período</h2>
        <ul className="mt-3 divide-y divide-[#EEEEEE]">
          {GRUPOS.map((grupo) => {
            const itens = expenses.filter((item) => grupo.categorias.includes(item.category));
            const total = itens.reduce((soma, item) => soma + item.amount, 0);
            if (total <= 0) return null;
            const pendente =
              itens.some((item) => item.posting !== "realizado") ||
              itens.some((item) => despesaSemSocio(item));
            return (
              <li key={grupo.id} className="flex items-start justify-between gap-3 py-3">
                <span>
                  <span className="block text-[15px] font-bold">{grupo.titulo}</span>
                  <span className="text-[13px] text-tse-muted">
                    {pendente ? "Pendente" : "Rateado"}
                  </span>
                </span>
                <span className="text-[15px] font-bold">{formatMil(total)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-bold">Consolidado por sócio</h2>
          <span className="rounded-full bg-tse-bg px-2.5 py-1 text-[11px] font-bold text-tse-muted">
            {partners.length} sócios
          </span>
        </div>
        <div className="mt-4 hidden grid-cols-[1.2fr_1fr_1fr_1fr] gap-2 text-[11px] font-bold tracking-wide text-tse-muted uppercase sm:grid">
          <span>Sócio</span>
          <span className="text-right">Responsabilidade</span>
          <span className="text-right">Pago</span>
          <span className="text-right">Saldo</span>
        </div>
        <ul className="mt-2 divide-y divide-[#EEEEEE]">
          {partners.map((item) => {
            const aPagar = Math.max(0, item.saldo);
            return (
              <li key={item.partnerId} className="py-3">
                <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr] sm:items-center">
                  <span className="flex items-center gap-2 font-bold">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: corDoSocio(item.partnerId) }}
                    />
                    {partnerShort(item.partnerId)}
                  </span>
                  <span className="flex justify-between text-[13px] tabular-nums sm:block sm:text-right">
                    <span className="text-tse-muted sm:hidden">Responsabilidade</span>
                    {formatMil(item.total)}
                  </span>
                  <span className="flex justify-between text-[13px] tabular-nums sm:block sm:text-right">
                    <span className="text-tse-muted sm:hidden">Pago</span>
                    {formatMil(item.pago)}
                  </span>
                  <span className="flex justify-between text-[13px] font-bold tabular-nums sm:block sm:text-right">
                    <span className="font-normal text-tse-muted sm:hidden">Saldo</span>
                    {aPagar > 1 ? (
                      formatMil(aPagar)
                    ) : (
                      <span className="text-[#15803D]">Quitado</span>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <Link
          href="/despesas"
          className="mt-4 inline-flex items-center gap-1 text-[13px] font-bold text-tse-olive"
        >
          Ver detalhes por sócio
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </section>

      <RelatoriosRateio months={months} aircraftId={aircraftId} />
    </>
  );
}

function ResumoBloco({
  titulo,
  valor,
  detalhe,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
}) {
  return (
    <div className="rounded-xl border border-[#EEF0F3] bg-tse-bg px-4 py-3">
      <p className="text-[13px] font-semibold text-tse-muted">{titulo}</p>
      <p className="mt-1 text-[22px] font-bold tracking-tight tabular-nums">{valor}</p>
      <p className="mt-0.5 text-[12px] text-tse-muted">{detalhe}</p>
    </div>
  );
}

function Acordeao({
  aberto,
  onToggle,
  titulo,
  subtitulo,
  children,
}: {
  aberto: boolean;
  onToggle: () => void;
  titulo: string;
  subtitulo: string;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold">{titulo}</span>
          <span className="block text-[12px] text-tse-muted">{subtitulo}</span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-tse-muted transition-transform", aberto && "rotate-180")}
          aria-hidden
        />
      </button>
      {aberto ? <div className="space-y-2 pb-3">{children}</div> : null}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3 text-[13px]">
      <span className="text-tse-muted">{rotulo}</span>
      <span className="font-semibold">{valor}</span>
    </div>
  );
}

function despesaSemSocio(expense: Expense): boolean {
  if (expense.partnerId) return false;
  if (expense.itineraryId) {
    const trip = getItinerary(expense.itineraryId);
    if (trip?.requestedBy) return false;
  }
  if (expense.allocation === "participacao" && !expense.manual) return false;
  return true;
}

function despesasPendentesRateio(months: MonthFilter, aircraftId: string): Expense[] {
  return expensesIn(months, aircraftId).filter(despesaSemSocio);
}
