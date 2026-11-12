"use client";

import Link from "next/link";
import {
  BadgeCheck,
  ChevronRight,
  Clock3,
  type LucideIcon,
} from "lucide-react";
import { AgendaCalendario } from "@/components/itinerarios/agenda-calendario";
import { AcoesRelatorio } from "@/components/relatorios/acoes-relatorio";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import { PageStack, StatusBadge } from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { cn, formatHours, formatMil, formatPercent } from "@/lib/format";
import { corDoSocio } from "@/lib/labels";
import {
  consumoMedioGph,
  expensesIn,
  getAircraft,
  getAlertas,
  getItinerary,
  getRateio,
  listAircraft,
  partnerShort,
  posicaoDespesas,
  type MonthFilter,
  type PosicaoDespesas,
} from "@/services/operacao";
import { relatorioPainel } from "@/services/relatorios-operacao";
import type { Aircraft, ExpenseCategory, RateioPartner } from "@/types/operacao";

const GALAO_EM_LITROS = 3.785411784;

export function PainelView() {
  useDados();
  const { aircraftId, months, partnerId } = useOperacao();
  const rateio = getRateio(months, aircraftId);
  const eu = partnerId
    ? rateio.partners.find((item) => item.partnerId === partnerId)
    : undefined;
  const craft =
    aircraftId !== "todas"
      ? getAircraft(aircraftId)
      : listAircraft()[0];
  const semSocio = despesasSemIdentificacao(months, aircraftId);
  const faltaReceberSocios = rateio.partners.reduce(
    (soma, item) => soma + Math.max(0, item.saldo),
    0,
  );
  const alertas = getAlertas(months, aircraftId);
  const pagamentosConferir = alertas.filter((item) => item.tone === "atencao" || item.tone === "critico");
  const posicaoOperacao = posicaoDespesas(months, aircraftId, null);

  return (
    <PageStack>
      <FiltrosOperacao legenda="O período altera o resumo da operação e o rateio." />

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
        <PainelSocio eu={eu} partners={rateio.partners} craft={craft} />
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
  partners,
  craft,
}: {
  eu: RateioPartner;
  partners: RateioPartner[];
  craft: Aircraft | undefined;
}) {
  const ownership = craft?.ownership ?? [];
  const gph = craft ? consumoMedioGph(craft.id) : CONSUMO_MEDIO_FALLBACK;
  const horasTotais = partners.reduce((soma, item) => soma + item.hours, 0);
  const linhasRateio = partners.map((item) => fatiaRateio(item, gph));
  const totaisRateio = linhasRateio.reduce(
    (acc, item) => ({
      fixo: acc.fixo + item.fixo,
      variavel: acc.variavel + item.variavel,
      tarifas: acc.tarifas + item.tarifas,
      litros: acc.litros + item.litros,
      total: acc.total + item.total,
    }),
    { fixo: 0, variavel: 0, tarifas: 0, litros: 0, total: 0 },
  );

  return (
    <>
      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-[15px] font-bold tracking-tight">Horas voadas × participação</h2>
        <ul className="mt-4 space-y-3.5">
          {partners.map((item) => {
            const cota = ownership.find((owner) => owner.partnerId === item.partnerId)?.share ?? 0;
            const pctHoras = horasTotais > 0 ? (item.hours / horasTotais) * 100 : 0;
            const souEu = item.partnerId === eu.partnerId;
            const cor = corDoSocio(item.partnerId);
            return (
              <li
                key={item.partnerId}
                className={cn(
                  "rounded-xl px-2 py-2 sm:px-2.5",
                  souEu && "bg-[#F7F5FB]",
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-20 shrink-0 truncate text-[13px] font-bold sm:w-24"
                    style={{ color: cor }}
                  >
                    {partnerShort(item.partnerId)}
                    {souEu ? " · você" : ""}
                  </span>
                  <div className="relative h-2.5 min-w-0 flex-1 rounded-full bg-[#EEF0F3]">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${Math.min(100, pctHoras)}%`, background: cor }}
                    />
                    {cota > 0 ? (
                      <span
                        className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-[#334155]/55"
                        style={{ left: `${Math.min(100, cota * 100)}%` }}
                        title={`Cota ${formatPercent(cota)}`}
                      />
                    ) : null}
                  </div>
                  <span className="w-[4.5rem] shrink-0 text-right sm:w-24">
                    <span className="block text-[13px] font-bold tabular-nums">
                      {formatHours(item.hours)}
                    </span>
                    <span className="block text-[10px] text-tse-muted sm:text-[11px]">
                      {formatPercent(horasTotais > 0 ? item.hours / horasTotais : 0)} das horas
                      {cota > 0 ? ` · cota ${formatPercent(cota)}` : ""}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] text-tse-muted">
          A linha vertical marca a participação societária. Barra acima da linha indica uso acima da
          cota.
        </p>
      </section>

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold tracking-tight">Rateio de custos</h2>
          <Link href="/rateio" className="text-[12px] font-bold text-[#6B5B95]">
            Ver detalhe
          </Link>
        </div>

        {/* Mobile: cards — sem scroll horizontal. */}
        <ul className="mt-3 space-y-2 sm:hidden">
          {linhasRateio.map((item) => {
            const souEu = item.partnerId === eu.partnerId;
            return (
              <li
                key={item.partnerId}
                className={cn(
                  "rounded-xl border border-[#EEF0F3] px-3 py-2.5",
                  souEu && "border-[#E8E4F5] bg-[#F7F5FB]",
                )}
              >
                <p className="flex items-center gap-2 text-[13px] font-bold">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: corDoSocio(item.partnerId) }}
                  />
                  {partnerShort(item.partnerId)}
                  {souEu ? (
                    <span className="text-[10px] font-semibold text-tse-muted">você</span>
                  ) : null}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-tse-muted">Fixo (R$)</dt>
                    <dd className="font-semibold tabular-nums">{formatNumero(item.fixo)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-tse-muted">Variável (R$)</dt>
                    <dd className="font-semibold tabular-nums">{formatNumero(item.variavel)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-tse-muted">Tarifas (R$)</dt>
                    <dd className="font-semibold tabular-nums">{formatNumero(item.tarifas)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-tse-muted">Litros</dt>
                    <dd className="font-semibold tabular-nums">
                      {item.litros > 0 ? formatInteiro(item.litros) : "—"}
                    </dd>
                  </div>
                  <div className="col-span-2 flex justify-between gap-2 border-t border-[#EEEEEE] pt-1.5">
                    <dt className="font-semibold text-tse-muted">Total (R$)</dt>
                    <dd className="font-bold tabular-nums">{formatNumero(item.total)}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
          <li className="rounded-xl bg-[#F6F3EE] px-3 py-2.5">
            <p className="text-[13px] font-bold">Total</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
              <div className="flex justify-between gap-2">
                <dt className="text-tse-muted">Fixo (R$)</dt>
                <dd className="font-bold tabular-nums">{formatNumero(totaisRateio.fixo)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-tse-muted">Variável (R$)</dt>
                <dd className="font-bold tabular-nums">{formatNumero(totaisRateio.variavel)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-tse-muted">Tarifas (R$)</dt>
                <dd className="font-bold tabular-nums">{formatNumero(totaisRateio.tarifas)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-tse-muted">Litros</dt>
                <dd className="font-bold tabular-nums">
                  {totaisRateio.litros > 0 ? formatInteiro(totaisRateio.litros) : "—"}
                </dd>
              </div>
              <div className="col-span-2 flex justify-between gap-2 border-t border-[#E5E0D8] pt-1.5">
                <dt className="font-semibold text-tse-muted">Total (R$)</dt>
                <dd className="font-bold tabular-nums">{formatNumero(totaisRateio.total)}</dd>
              </div>
            </dl>
          </li>
        </ul>

        {/* Desktop: tabela compacta, R$ só no header. */}
        <div className="mt-3 hidden sm:block">
          <table className="w-full table-fixed border-collapse text-left text-[12px] lg:text-[13px]">
            <thead>
              <tr className="text-[10px] font-bold tracking-wide text-tse-muted uppercase lg:text-[11px]">
                <th className="w-[22%] pb-2 font-bold">Sócio</th>
                <th className="w-[15%] pb-2 text-right font-bold">Fixo (R$)</th>
                <th className="w-[18%] pb-2 text-right font-bold">Variável (R$)</th>
                <th className="w-[15%] pb-2 text-right font-bold">Tarifas (R$)</th>
                <th className="w-[12%] pb-2 text-right font-bold">Litros</th>
                <th className="w-[18%] pb-2 text-right font-bold">Total (R$)</th>
              </tr>
            </thead>
            <tbody>
              {linhasRateio.map((item) => {
                const souEu = item.partnerId === eu.partnerId;
                return (
                  <tr
                    key={item.partnerId}
                    className={cn("border-t border-[#EEEEEE]", souEu && "bg-[#F7F5FB]")}
                  >
                    <td className="truncate py-2.5 pr-2 font-bold">
                      <span className="inline-flex max-w-full items-center gap-1.5">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: corDoSocio(item.partnerId) }}
                        />
                        <span className="truncate">{partnerShort(item.partnerId)}</span>
                        {souEu ? (
                          <span className="shrink-0 text-[10px] font-semibold text-tse-muted">
                            você
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{formatNumero(item.fixo)}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatNumero(item.variavel)}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatNumero(item.tarifas)}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {item.litros > 0 ? formatInteiro(item.litros) : "—"}
                    </td>
                    <td className="py-2.5 text-right font-bold tabular-nums">
                      {formatNumero(item.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#D8D8D8] text-[12px] font-bold lg:text-[13px]">
                <td className="pt-2.5">Total</td>
                <td className="pt-2.5 text-right tabular-nums">
                  {formatNumero(totaisRateio.fixo)}
                </td>
                <td className="pt-2.5 text-right tabular-nums">
                  {formatNumero(totaisRateio.variavel)}
                </td>
                <td className="pt-2.5 text-right tabular-nums">
                  {formatNumero(totaisRateio.tarifas)}
                </td>
                <td className="pt-2.5 text-right tabular-nums">
                  {totaisRateio.litros > 0 ? formatInteiro(totaisRateio.litros) : "—"}
                </td>
                <td className="pt-2.5 text-right tabular-nums">
                  {formatNumero(totaisRateio.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-tse-muted">
          Custo fixo dividido pela participação; custo variável pelas horas voadas por cada sócio.
          Tarifas DECEA e de aeroporto entram direto na conta de quem voou.
        </p>
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

function BarraSituacao({ posicao }: { posicao: PosicaoDespesas }) {
  if (posicao.total <= 0) return null;
  return (
    <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-tse-bg">
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
}: {
  icone: LucideIcon;
  tom: "faturado" | "previsto" | "provisionado";
  rotulo: string;
  valor: number;
  detalhe: string;
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
    <div className={cn("rounded-xl p-3", fundo)}>
      <div className="flex items-start gap-2">
        <Icone className={cn("mt-0.5 size-4 shrink-0", cor)} aria-hidden />
        <div className="min-w-0">
          <dt className="text-tse-muted">{rotulo}</dt>
          <dd className={cn("mt-0.5 text-[18px] font-bold tracking-tight tabular-nums", cor)}>
            {formatMil(valor)}
          </dd>
          <p className="mt-0.5 text-[11px] text-tse-muted">{detalhe}</p>
        </div>
      </div>
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

const CONSUMO_MEDIO_FALLBACK = 74;

function categoriaDoParceiro(partner: RateioPartner, category: ExpenseCategory): number {
  return partner.byCategory.find((item) => item.category === category)?.amount ?? 0;
}

function fatiaRateio(partner: RateioPartner, gph: number) {
  const tarifas = categoriaDoParceiro(partner, "taxas");
  return {
    partnerId: partner.partnerId,
    fixo: partner.participacao,
    variavel: Math.max(0, partner.voos - tarifas),
    tarifas,
    litros: partner.hours * gph * GALAO_EM_LITROS,
    total: partner.total,
  };
}

function formatInteiro(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function formatNumero(value: number): string {
  if (Math.abs(value) < 0.5) return "0";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

