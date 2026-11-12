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
import { AgendaCalendario } from "@/components/itinerarios/agenda-calendario";
import { AcoesRelatorio } from "@/components/relatorios/acoes-relatorio";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import { PageStack, StatusBadge } from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { cn, formatBRL, formatHours, formatMil } from "@/lib/format";
import { corDoSocio, CORES_AGENDA, fundoCalendarioSocio } from "@/lib/labels";
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

      <AgendaCalendario compacto />

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
  const corEu = corDoSocio(eu.partnerId);
  const fundoEu = fundoCalendarioSocio(eu.partnerId);
  return (
    <>
      <section
        className="overflow-hidden rounded-2xl border border-[#E8E4F5] bg-white shadow-sm"
        style={{ borderTopColor: corEu, borderTopWidth: 3 }}
      >
        <div className="px-3 py-2.5 sm:px-4" style={{ background: fundoEu }}>
          <p className="text-[12px] font-bold tracking-wide uppercase" style={{ color: corEu }}>
            Minha conta
          </p>
          <p className="mt-1 text-[13px] text-tse-text">
            {falta > 1 ? "Falta pagar neste período" : "Seu aporte está em dia"}
          </p>
          <p
            className="mt-0.5 text-[26px] leading-none font-bold tracking-tight tabular-nums sm:text-[28px]"
            style={{ color: falta > 1 ? CORES_AGENDA.humberto : CORES_AGENDA.ruan }}
          >
            {falta > 1 ? formatBRL(falta) : formatBRL(0)}
          </p>
        </div>
        <div className="p-3 sm:p-4">
          <dl className="space-y-1.5 text-[13px]">
            <LinhaConta
              icone={CircleDollarSign}
              rotulo="Sua parte"
              valor={formatBRL(eu.total)}
              tom="previsto"
            />
            <LinhaConta
              icone={BadgeCheck}
              rotulo="Já faturado"
              valor={formatBRL(posicaoEu.realizado)}
              tom="faturado"
            />
            <LinhaConta
              icone={Clock3}
              rotulo="Ainda sem fatura"
              valor={formatBRL(posicaoEu.provisionado + posicaoEu.previsto)}
              tom="provisionado"
            />
            <LinhaConta
              icone={CheckCircle2}
              rotulo="Você já pagou"
              valor={formatBRL(eu.pago)}
              tom="faturado"
            />
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <LinkAcao href="/despesas" icone={FileText}>
              Ver minhas despesas
            </LinkAcao>
            <LinkAcao href="/itinerarios" icone={Plane}>
              Ver meus voos
            </LinkAcao>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#E4F0E3] bg-white shadow-sm">
        <div className="bg-pos-faturado-soft px-3 py-2.5 sm:px-4">
          <p className="text-[12px] font-bold tracking-wide text-pos-faturado uppercase">
            Custo da frota
          </p>
          <p className="mt-1 text-[24px] leading-none font-bold tracking-tight text-[#3F6B4A] tabular-nums sm:text-[28px]">
            {formatMil(posicaoOperacao.total)}
          </p>
          <p className="mt-0.5 text-[11px] text-tse-muted">
            Toda a operação no período — sua parte está em Minha conta.
          </p>
          <BarraSituacao posicao={posicaoOperacao} compacta />
        </div>
        <div className="p-3 sm:p-4">
          <dl className="grid grid-cols-3 gap-2 text-[12px]">
            <SituacaoDespesa
              icone={BadgeCheck}
              tom="faturado"
              rotulo="Faturado"
              valor={posicaoOperacao.realizado}
              detalhe="Com NF / lançado"
              compacta
            />
            <SituacaoDespesa
              icone={Clock3}
              tom="previsto"
              rotulo="Previsto"
              valor={posicaoOperacao.previsto}
              detalhe="Ainda por vir"
              compacta
            />
            <SituacaoDespesa
              icone={Clock3}
              tom="provisionado"
              rotulo="Provisionado"
              valor={posicaoOperacao.provisionado}
              detalhe="Sem fatura ainda"
              compacta
            />
          </dl>
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[#F6F3EE] p-2.5">
            <MetricaIcone icone={Plane} label="Voos" value={String(voos)} compacta />
            <MetricaIcone icone={Clock3} label="Horas" value={formatHours(horas)} compacta />
            <MetricaIcone
              icone={CircleDollarSign}
              label="Custo/hora"
              value={custoHora === null ? "—" : formatBRL(Math.round(custoHora))}
              compacta
            />
          </div>
          <div className="mt-3">
            <LinkAcao href="/rateio">Ver rateio entre sócios</LinkAcao>
          </div>
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
      <section className="overflow-hidden rounded-2xl border border-[#E4F0E3] bg-white shadow-sm">
        <div className="bg-pos-faturado-soft px-4 py-3 sm:px-5">
          <p className="text-[12px] font-bold tracking-wide text-pos-faturado uppercase">
            Despesas do período
          </p>
          <p className="mt-1 text-[32px] leading-none font-bold tracking-tight text-[#3F6B4A] tabular-nums">
            {formatMil(posicao.total)}
          </p>
          <BarraSituacao posicao={posicao} />
        </div>
        <div className="p-4 sm:p-5">
        <dl className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-3">
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
            <span className="bg-pos-faturado" style={{ width: `${pctPago}%` }} />
            <span className="bg-pos-provisionado" style={{ width: `${pctAberto}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-pos-faturado" />
              Já pago {formatMil(pago)}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-pos-provisionado" />
              Em aberto {formatMil(emAberto)}
            </span>
          </div>
        </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E8E4F5] bg-white p-5 shadow-sm">
        <p className="text-[13px] font-semibold text-[#6B5B95]">Situação dos sócios</p>
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
                        className="block h-full rounded-full bg-pos-faturado"
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
            <span className="rounded-full bg-pos-provisionado px-2 py-0.5 text-[11px] font-bold text-white">
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

function BarraSituacao({
  posicao,
  compacta = false,
}: {
  posicao: PosicaoDespesas;
  compacta?: boolean;
}) {
  if (posicao.total <= 0) return null;
  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-full bg-tse-bg",
        compacta ? "mt-1.5 h-1.5" : "mt-3 h-2.5",
      )}
    >
      {posicao.realizado > 0 ? (
        <span
          className="bg-pos-faturado"
          style={{ width: `${(posicao.realizado / posicao.total) * 100}%` }}
          title="Faturado"
        />
      ) : null}
      {posicao.previsto > 0 ? (
        <span
          className="bg-pos-previsto"
          style={{ width: `${(posicao.previsto / posicao.total) * 100}%` }}
          title="Previsto"
        />
      ) : null}
      {posicao.provisionado > 0 ? (
        <span
          className="bg-pos-provisionado"
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
  compacta = false,
}: {
  icone: LucideIcon;
  tom: "faturado" | "previsto" | "provisionado";
  rotulo: string;
  valor: number;
  detalhe: string;
  compacta?: boolean;
}) {
  const fundo =
    tom === "faturado"
      ? "bg-pos-faturado-soft"
      : tom === "previsto"
        ? "bg-pos-previsto-soft"
        : "bg-pos-provisionado-soft";
  const cor =
    tom === "faturado"
      ? "text-pos-faturado"
      : tom === "previsto"
        ? "text-pos-previsto"
        : "text-pos-provisionado";
  return (
    <div
      className={cn(
        "rounded-xl",
        compacta ? "p-2" : "p-3",
        fundo,
      )}
    >
      <div className={cn("flex items-start", compacta ? "gap-1" : "gap-2")}>
        <Icone
          className={cn("shrink-0", compacta ? "mt-0.5 size-3.5" : "mt-0.5 size-4", cor)}
          aria-hidden
        />
        <div className="min-w-0">
          <dt className={cn(cor, compacta ? "text-[11px] font-semibold" : "text-tse-muted")}>
            {rotulo}
          </dt>
          <dd
            className={cn(
              "font-bold tracking-tight tabular-nums",
              cor,
              compacta ? "mt-0 text-[14px]" : "mt-0.5 text-[18px]",
            )}
          >
            {formatMil(valor)}
          </dd>
          {compacta ? null : <p className="mt-0.5 text-[11px] text-tse-muted">{detalhe}</p>}
        </div>
      </div>
    </div>
  );
}

function MetricaIcone({
  icone: Icone,
  label,
  value,
  compacta = false,
}: {
  icone: LucideIcon;
  label: string;
  value: string;
  compacta?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className={cn("flex items-center gap-1 text-tse-muted", compacta ? "text-[10px]" : "text-[11px]")}>
        <Icone className="size-3.5 shrink-0 text-[#6B5B95]" aria-hidden />
        {label}
      </p>
      <p
        className={cn(
          "truncate font-bold tracking-tight text-[#4F4270] tabular-nums",
          compacta ? "mt-0.5 text-[15px]" : "mt-1 text-[18px] sm:text-[20px]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function LinhaConta({
  icone: Icone,
  rotulo,
  valor,
  tom = "previsto",
}: {
  icone: LucideIcon;
  rotulo: string;
  valor: string;
  tom?: "faturado" | "previsto" | "provisionado";
}) {
  const cor =
    tom === "faturado"
      ? "text-pos-faturado"
      : tom === "provisionado"
        ? "text-pos-provisionado"
        : "text-pos-previsto";
  const fundo =
    tom === "faturado"
      ? "bg-pos-faturado-soft"
      : tom === "provisionado"
        ? "bg-pos-provisionado-soft"
        : "bg-pos-previsto-soft";
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-lg px-2 py-1.5", fundo)}>
      <dt className={cn("flex min-w-0 items-center gap-2", cor)}>
        <Icone className="size-4 shrink-0" aria-hidden />
        <span className="truncate font-medium text-tse-text">{rotulo}</span>
      </dt>
      <dd className={cn("shrink-0 font-bold tabular-nums", cor)}>{valor}</dd>
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
      className="inline-flex items-center gap-1.5 rounded-full bg-[#E8E4F5] px-3 py-1.5 text-[12px] font-bold text-[#6B5B95]"
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
          <span className={cn("text-[16px] font-bold", valor > 0 ? "text-pos-provisionado" : "text-tse-muted")}>
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

