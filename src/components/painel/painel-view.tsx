"use client";

import Link from "next/link";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  Plane,
  type LucideIcon,
} from "lucide-react";
import { AcoesRelatorio } from "@/components/relatorios/acoes-relatorio";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import { PageStack, StatusBadge } from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { cn, formatBRL, formatHours, formatMil } from "@/lib/format";
import { corDoSocio } from "@/lib/labels";
import {
  expensesIn,
  getAircraft,
  getAlertas,
  getItinerary,
  getKpis,
  getRateio,
  itinerariesIn,
  listAircraft,
  partnerShort,
  posicaoDespesas,
  type MonthFilter,
  type PosicaoDespesas,
} from "@/services/operacao";
import { relatorioPainel } from "@/services/relatorios-operacao";
import type { RateioPartner } from "@/types/operacao";

export function PainelView() {
  useDados();
  const { aircraftId, months, partnerId } = useOperacao();
  const kpis = getKpis(months, aircraftId);
  const rateio = getRateio(months, aircraftId);
  const eu = partnerId
    ? rateio.partners.find((item) => item.partnerId === partnerId)
    : undefined;
  const craft =
    aircraftId !== "todas"
      ? getAircraft(aircraftId)
      : listAircraft()[0];
  const voos = itinerariesIn(months, aircraftId).filter((trip) => trip.status !== "cancelado");
  const semSocio = despesasSemIdentificacao(months, aircraftId);
  const faltaReceberSocios = rateio.partners.reduce(
    (soma, item) => soma + Math.max(0, item.saldo),
    0,
  );
  const alertas = getAlertas(months, aircraftId);
  const pagamentosConferir = alertas.filter((item) => item.tone === "atencao" || item.tone === "critico");
  // Frota = posicaoOperacao; fatia do sócio = posicaoEu / Minha conta.
  const posicaoOperacao = posicaoDespesas(months, aircraftId, null);
  const posicaoEu = partnerId
    ? posicaoDespesas(months, aircraftId, partnerId)
    : posicaoOperacao;

  return (
    <PageStack>
      <FiltrosOperacao legenda="O período altera o resumo da operação e a minha conta." />

      {/* Sócio: o seletor já diz a frota — evita repetir "Toda a operação". */}
      {!eu && craft ? (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="font-display text-[18px] tracking-wide">
              {aircraftId === "todas" ? "Toda a operação" : craft.registration}
            </p>
            <p className="text-[13px] text-tse-muted">
              {aircraftId === "todas"
                ? `${listAircraft().length} aeronave(s)`
                : `${craft.manufacturer} ${craft.model}`}
            </p>
          </div>
          {aircraftId !== "todas" ? <StatusBadge value={craft.status} /> : null}
        </section>
      ) : null}

      {eu ? (
        <PainelSocio
          eu={eu}
          posicaoOperacao={posicaoOperacao}
          posicaoEu={posicaoEu}
          voos={voos.length}
          horas={kpis.horasVoadas}
          custoHora={kpis.custoHora}
        />
      ) : (
        <PainelAdmin
          posicao={posicaoOperacao}
          despesasRateadas={rateio.total}
          pago={rateio.pago}
          emAberto={faltaReceberSocios}
          partners={rateio.partners}
          semSocio={semSocio}
          pagamentosConferir={pagamentosConferir.length}
        />
      )}

      <AcoesRelatorio
        titulo="Relatório do painel"
        texto={
          eu
            ? "Baixa faturado / previsto / provisionado e a sua conta neste período em PDF ou Excel."
            : "Baixa faturado / previsto / provisionado e a situação de cada sócio em PDF ou Excel."
        }
        gerar={() => relatorioPainel(months, aircraftId, partnerId)}
      />
    </PageStack>
  );
}

function PainelSocio({
  eu,
  posicaoOperacao,
  posicaoEu,
  voos,
  horas,
  custoHora,
}: {
  eu: RateioPartner;
  posicaoOperacao: PosicaoDespesas;
  posicaoEu: PosicaoDespesas;
  voos: number;
  horas: number;
  custoHora: number | null;
}) {
  const falta = Math.max(0, eu.saldo);
  return (
    <>
      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[13px] font-semibold text-tse-muted">Minha conta</p>
        <p className="mt-3 text-[15px] text-tse-text">
          {falta > 1 ? "Falta pagar neste período" : "Seu aporte está em dia"}
        </p>
        <p className="mt-1 text-[34px] leading-none font-bold tracking-tight tabular-nums">
          {falta > 1 ? formatBRL(falta) : formatBRL(0)}
        </p>
        <dl className="mt-4 space-y-2.5 text-[14px]">
          <LinhaConta
            icone={CircleDollarSign}
            rotulo="Sua parte"
            valor={formatBRL(eu.total)}
          />
          <LinhaConta
            icone={BadgeCheck}
            rotulo="Já faturado"
            valor={formatBRL(posicaoEu.realizado)}
          />
          <LinhaConta
            icone={Clock3}
            rotulo="Ainda sem fatura"
            valor={formatBRL(posicaoEu.provisionado + posicaoEu.previsto)}
          />
          <LinhaConta
            icone={CheckCircle2}
            rotulo="Você já pagou"
            valor={formatBRL(eu.pago)}
            destaque
          />
        </dl>
        <div className="mt-4 flex flex-col gap-2.5">
          <LinkAcao href="/despesas" icone={FileText}>
            Ver minhas despesas
          </LinkAcao>
          <LinkAcao href="/itinerarios" icone={Plane}>
            Ver meus voos
          </LinkAcao>
        </div>
      </section>

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[13px] font-semibold text-tse-muted">Custo da frota</p>
        <p className="mt-1 text-[28px] leading-none font-bold tracking-tight tabular-nums sm:text-[32px]">
          {formatMil(posicaoOperacao.total)}
        </p>
        <p className="mt-1 text-[12px] text-tse-muted">
          Toda a operação no período — sua parte está em Minha conta.
        </p>
        <BarraSituacao posicao={posicaoOperacao} />
        <dl className="mt-3 grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-3">
          <SituacaoDespesa
            icone={BadgeCheck}
            tom="faturado"
            rotulo="Faturado"
            valor={posicaoOperacao.realizado}
            detalhe="Com NF / lançado"
          />
          <SituacaoDespesa
            icone={Clock3}
            tom="previsto"
            rotulo="Previsto"
            valor={posicaoOperacao.previsto}
            detalhe="Ainda por vir"
          />
          <SituacaoDespesa
            icone={Clock3}
            tom="provisionado"
            rotulo="Provisionado"
            valor={posicaoOperacao.provisionado}
            detalhe="Sem fatura ainda"
          />
        </dl>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#EEEEEE] pt-3">
          <MetricaIcone icone={Plane} label="Voos" value={String(voos)} />
          <MetricaIcone icone={Clock3} label="Horas" value={formatHours(horas)} />
          <MetricaIcone
            icone={CircleDollarSign}
            label="Custo/hora"
            value={custoHora === null ? "—" : formatBRL(Math.round(custoHora))}
          />
        </div>
        <div className="mt-4">
          <LinkAcao href="/rateio">Ver rateio entre sócios</LinkAcao>
        </div>
      </section>
    </>
  );
}

function PainelAdmin({
  posicao,
  despesasRateadas,
  pago,
  emAberto,
  partners,
  semSocio,
  pagamentosConferir,
}: {
  posicao: PosicaoDespesas;
  despesasRateadas: number;
  pago: number;
  emAberto: number;
  partners: RateioPartner[];
  semSocio: number;
  pagamentosConferir: number;
}) {
  const baseAportes = Math.max(despesasRateadas, pago + emAberto, 1);
  const pctPago = Math.min(100, (pago / baseAportes) * 100);
  const pctAberto = Math.min(100 - pctPago, (emAberto / baseAportes) * 100);
  const pendencias = semSocio + pagamentosConferir;

  return (
    <>
      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[13px] font-semibold text-tse-muted">Despesas do período</p>
        <p className="mt-1 text-[36px] leading-none font-bold tracking-tight tabular-nums">
          {formatMil(posicao.total)}
        </p>
        <BarraSituacao posicao={posicao} />
        <dl className="mt-4 grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-3">
          <SituacaoDespesa
            icone={BadgeCheck}
            tom="faturado"
            rotulo="Faturado"
            valor={posicao.realizado}
            detalhe="Com NF / lançado"
          />
          <SituacaoDespesa
            icone={Clock3}
            tom="previsto"
            rotulo="Previsto"
            valor={posicao.previsto}
            detalhe="Ainda por vir"
          />
          <SituacaoDespesa
            icone={Clock3}
            tom="provisionado"
            rotulo="Provisionado"
            valor={posicao.provisionado}
            detalhe="Sem fatura ainda"
          />
        </dl>

        <div className="mt-5 border-t border-[#EEEEEE] pt-4">
          <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">
            Aportes dos sócios
          </p>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-tse-bg">
            <span className="bg-[#16A34A]" style={{ width: `${pctPago}%` }} />
            <span className="bg-[#EA580C]" style={{ width: `${pctAberto}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#16A34A]" />
              Já pago {formatMil(pago)}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#EA580C]" />
              Em aberto {formatMil(emAberto)}
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-[13px] font-semibold text-tse-muted">Situação dos sócios</p>
        <ul className="mt-3 divide-y divide-[#EEEEEE]">
          {partners.map((item) => {
            const width = item.total > 0 ? Math.min(100, (item.pago / item.total) * 100) : 0;
            const aPagar = Math.max(0, item.saldo);
            return (
              <li key={item.partnerId}>
                <Link
                  href="/despesas"
                  className="flex items-center gap-3 py-3.5"
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                    style={{ background: corDoSocio(item.partnerId) }}
                  >
                    {iniciais(partnerShort(item.partnerId))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-bold">{partnerShort(item.partnerId)}</span>
                      <span className="text-[14px] font-bold">
                        {aPagar > 1 ? `${formatMil(aPagar)} a pagar` : "Em dia"}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[12px] text-tse-muted">
                      De {formatMil(item.total)} · pago {formatMil(item.pago)}
                    </span>
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-tse-bg">
                      <span
                        className="block h-full rounded-full bg-[#16A34A]"
                        style={{ width: `${width}%` }}
                      />
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-tse-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-5">
          <LinkAcao href="/rateio">Ver financeiro completo</LinkAcao>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-tse-muted">Pendências de gestão</p>
          {pendencias > 0 ? (
            <span className="rounded-full bg-[#EA580C] px-2 py-0.5 text-[11px] font-bold text-white">
              {pendencias}
            </span>
          ) : null}
        </div>
        <ul className="mt-3 divide-y divide-[#EEEEEE]">
          <Pendencia
            href="/despesas"
            titulo="Despesas aguardando rateio"
            valor={semSocio}
          />
          <Pendencia
            href="/rateio"
            titulo="Pagamentos para conferir"
            valor={pagamentosConferir}
          />
        </ul>
      </section>
    </>
  );
}

function BarraSituacao({ posicao }: { posicao: PosicaoDespesas }) {
  if (posicao.total <= 0) return null;
  return (
    <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-tse-bg">
      {posicao.realizado > 0 ? (
        <span
          className="bg-[#16A34A]"
          style={{ width: `${(posicao.realizado / posicao.total) * 100}%` }}
          title="Faturado"
        />
      ) : null}
      {posicao.previsto > 0 ? (
        <span
          className="bg-[#2563EB]"
          style={{ width: `${(posicao.previsto / posicao.total) * 100}%` }}
          title="Previsto"
        />
      ) : null}
      {posicao.provisionado > 0 ? (
        <span
          className="bg-[#EA580C]"
          style={{ width: `${(posicao.provisionado / posicao.total) * 100}%` }}
          title="Provisionado"
        />
      ) : null}
    </div>
  );
}

function SituacaoDespesa({
  icone: Icone,
  tom,
  rotulo,
  valor,
  detalhe,
}: {
  icone: LucideIcon;
  tom: "faturado" | "previsto" | "provisionado";
  rotulo: string;
  valor: number;
  detalhe: string;
}) {
  const cor =
    tom === "faturado" ? "text-[#16A34A]" : tom === "previsto" ? "text-[#2563EB]" : "text-[#EA580C]";
  return (
    <div className="flex items-start gap-2">
      <Icone className={cn("mt-0.5 size-4 shrink-0", cor)} aria-hidden />
      <div className="min-w-0">
        <dt className="text-tse-muted">{rotulo}</dt>
        <dd className="mt-0.5 text-[18px] font-bold tracking-tight tabular-nums">
          {formatMil(valor)}
        </dd>
        <p className="mt-0.5 text-[11px] text-tse-muted">{detalhe}</p>
      </div>
    </div>
  );
}

function MetricaIcone({
  icone: Icone,
  label,
  value,
}: {
  icone: LucideIcon;
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

function LinhaConta({
  icone: Icone,
  rotulo,
  valor,
  destaque = false,
}: {
  icone: LucideIcon;
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex min-w-0 items-center gap-2 text-tse-muted">
        <Icone
          className={cn("size-4 shrink-0", destaque ? "text-[#16A34A]" : "text-tse-olive")}
          aria-hidden
        />
        <span className="truncate">{rotulo}</span>
      </dt>
      <dd className={cn("shrink-0 font-bold tabular-nums", destaque && "text-[#16A34A]")}>
        {valor}
      </dd>
    </div>
  );
}

function LinkAcao({
  href,
  children,
  icone: Icone,
}: {
  href: string;
  children: string;
  icone?: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[13px] font-bold text-tse-olive"
    >
      {Icone ? <Icone className="size-4 shrink-0" aria-hidden /> : null}
      {children}
      <ChevronRight className="size-4" aria-hidden />
    </Link>
  );
}

function Pendencia({
  href,
  titulo,
  valor,
}: {
  href: string;
  titulo: string;
  valor: number;
}) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 py-3">
        <span className="text-[14px] font-semibold">{titulo}</span>
        <span className="flex items-center gap-2">
          <span className={cn("text-[16px] font-bold", valor > 0 ? "text-[#EA580C]" : "text-tse-muted")}>
            {valor}
          </span>
          <ChevronRight className="size-4 text-tse-muted" aria-hidden />
        </span>
      </Link>
    </li>
  );
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return (partes[0]?.[0] ?? "•").toUpperCase();
}

function despesaSemIdentificacao(expense: ReturnType<typeof expensesIn>[number]): boolean {
  if (expense.partnerId) return false;
  if (expense.itineraryId) {
    const trip = getItinerary(expense.itineraryId);
    if (trip?.requestedBy) return false;
  }
  if (expense.allocation === "participacao" && !expense.manual) return false;
  return true;
}

function despesasSemIdentificacao(months: MonthFilter, aircraftId: string): number {
  return expensesIn(months, aircraftId).filter(despesaSemIdentificacao).length;
}

