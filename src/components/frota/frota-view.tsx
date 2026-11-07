"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CircleDollarSign,
  Clock3,
  Plane,
  Plus,
} from "lucide-react";
import { BotaoNovo, LinkEditar } from "@/components/formularios/campos";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import {
  OwnershipBar,
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
import { formatBRL, formatHours } from "@/lib/format";
import { CATEGORY_TONE } from "@/lib/labels";
import {
  aircraftMonth,
  getKpis,
  listAircraft,
  matchesAircraft,
  monthsLabel,
} from "@/services/operacao";
import type { Aircraft } from "@/types/operacao";

export function FrotaView() {
  useDados();
  const { aircraftId, months, partnerId } = useOperacao();
  const fleet = listAircraft()
    .filter((item) => matchesAircraft(item.id, aircraftId))
    .filter(
      (item) =>
        !partnerId || item.ownership.some((owner) => owner.partnerId === partnerId),
    );
  const kpis = getKpis(months, aircraftId);
  const horasPeriodo = fleet.reduce((soma, item) => {
    const uso = aircraftMonth(item.id, months);
    return soma + uso.voadas + uso.previstas;
  }, 0);
  const custoPeriodo = fleet.reduce((soma, item) => soma + aircraftMonth(item.id, months).custo, 0);
  const prontas = fleet.filter((item) => item.status === "disponivel" || item.status === "em_voo").length;
  const craftAtiva = aircraftId !== "todas" ? fleet.find((item) => item.id === aircraftId) : null;
  const contextoPeriodo = [
    craftAtiva?.registration ?? (aircraftId === "todas" ? "Toda a operação" : aircraftId),
    monthsLabel(months),
  ].join(" · ");

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
              <h1 className="text-[22px] font-bold tracking-tight">Minha frota</h1>
              <p className="mt-0.5 text-[13px] text-tse-muted">{contextoPeriodo}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight">Frota</h1>
            <p className="mt-0.5 text-[13px] text-tse-muted">{contextoPeriodo}</p>
          </div>
          <Link
            href="/frota/nova"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-tse-text text-white shadow-sm md:hidden"
            aria-label="Nova aeronave"
          >
            <Plus className="size-5" aria-hidden />
          </Link>
        </div>
      )}

      <FiltrosOperacao
        compacto={Boolean(partnerId)}
        legenda={partnerId ? undefined : "A frota no período escolhido."}
      />

      {!partnerId ? (
        <div className="hidden justify-end md:flex">
          <BotaoNovo href="/frota/nova">Nova aeronave</BotaoNovo>
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">
          Resumo do período
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricaIcone icone={Plane} label="Aeronaves" value={String(fleet.length)} />
          <MetricaIcone
            icone={Plane}
            label="Disponíveis"
            value={`${prontas}/${fleet.length || kpis.totalAeronaves}`}
          />
          <MetricaIcone icone={Clock3} label="Horas" value={formatHours(horasPeriodo)} />
          <MetricaIcone
            icone={CircleDollarSign}
            label="Custo do período"
            value={formatBRL(Math.round(custoPeriodo))}
          />
        </div>
      </section>

      {fleet.length === 0 ? (
        <p className="rounded-2xl border border-[#EEF0F3] bg-white px-4 py-8 text-center text-[13px] text-tse-muted shadow-sm">
          Nenhuma aeronave neste recorte.
        </p>
      ) : (
        <>
          <p className="text-[13px] text-tse-muted">
            {fleet.length} aeronave{fleet.length === 1 ? "" : "s"} no recorte
          </p>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {fleet.map((item) => (
              <CartaoAeronave key={item.id} item={item} months={months} />
            ))}
          </div>

          <section className="hidden overflow-hidden rounded-2xl border border-[#EEF0F3] bg-white shadow-sm md:block">
            <div className="border-b border-[#EEEEEE] px-5 py-4">
              <p className="text-[14px] font-bold">Comparar</p>
              <p className="mt-0.5 text-[12px] text-tse-muted">
                {prontas} de {fleet.length} disponíveis agora.
              </p>
            </div>
            <TableWrap>
              <table className={tableClass}>
                <thead className={theadClass}>
                  <tr>
                    <th className={thClass}>Aeronave</th>
                    <th className={thClass}>Situação</th>
                    <th className={thClass}>Horas voadas</th>
                    <th className={thClass}>Horas previstas</th>
                    <th className={thClass}>Custo do período</th>
                    <th className={thClass}>Ciclos</th>
                    {!partnerId ? <th className={thClass}>Ação</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {fleet.map((item) => {
                    const uso = aircraftMonth(item.id, months);
                    return (
                      <tr key={item.id} className={trClass}>
                        <td className={tdClass}>
                          <Link href={`/frota/${item.id}`} className="font-bold hover:underline">
                            {item.registration}
                          </Link>
                          <span className="block text-[12px] text-tse-muted">{item.model}</span>
                        </td>
                        <td className={tdClass}>
                          <StatusBadge value={item.status} />
                        </td>
                        <td className={`${tdClass} tabular-nums`}>{formatHours(uso.voadas)}</td>
                        <td className={`${tdClass} tabular-nums`}>{formatHours(uso.previstas)}</td>
                        <td className={`${tdClass} tabular-nums`}>{formatBRL(uso.custo)}</td>
                        <td className={`${tdClass} tabular-nums`}>
                          {item.cycles.toLocaleString("pt-BR")}
                        </td>
                        {!partnerId ? (
                          <td className={tdClass}>
                            <LinkEditar href={`/frota/${item.id}/editar`} />
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </section>
        </>
      )}
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

function CartaoAeronave({
  item,
  months,
}: {
  item: Aircraft;
  months: Parameters<typeof aircraftMonth>[1];
}) {
  const uso = aircraftMonth(item.id, months);
  return (
    <Link
      href={`/frota/${item.id}`}
      className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[24px] tracking-wide sm:text-[28px]">
            {item.registration}
          </p>
          <p className="mt-1 text-[15px] font-semibold">
            {item.manufacturer} {item.model}
          </p>
          <p className="text-[13px] text-tse-muted">
            {CATEGORY_TONE[item.category]} · {item.year} · {item.seats} lugares
          </p>
        </div>
        <StatusBadge value={item.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
        <div>
          <dt className="text-tse-muted">Base</dt>
          <dd className="font-semibold">
            {item.baseName} · {item.baseIcao}
          </dd>
        </div>
        <div>
          <dt className="text-tse-muted">Célula</dt>
          <dd className="font-semibold tabular-nums">{formatHours(item.totalHours)}</dd>
        </div>
        <div>
          <dt className="text-tse-muted">No período</dt>
          <dd className="font-semibold tabular-nums">
            {formatHours(uso.voadas + uso.previstas)}
          </dd>
        </div>
        <div>
          <dt className="text-tse-muted">Custo do período</dt>
          <dd className="font-semibold tabular-nums">{formatBRL(uso.custo)}</dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-[#EEEEEE] pt-3">
        <OwnershipBar aircraftId={item.id} />
      </div>
    </Link>
  );
}
