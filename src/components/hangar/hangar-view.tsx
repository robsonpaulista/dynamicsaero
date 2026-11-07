"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CircleDollarSign,
  Clock3,
  Plus,
  Search,
  Warehouse,
} from "lucide-react";
import { BotaoNovo, LinkEditar } from "@/components/formularios/campos";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import { PageStack, StatusBadge } from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { daysUntil, formatBRL, formatDate } from "@/lib/format";
import {
  getAircraft,
  HOJE,
  listAircraft,
  listHangars,
  matchesAircraft,
  monthsLabel,
} from "@/services/operacao";
import type { Hangar } from "@/types/operacao";

export function HangarView() {
  useDados();
  const { aircraftId, months, partnerId } = useOperacao();
  const [query, setQuery] = useState<string>("");

  const hangars = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return listHangars()
      .filter((item) => matchesAircraft(item.aircraftId, aircraftId))
      .filter((item) => {
        if (!partnerId) return true;
        const craft = getAircraft(item.aircraftId);
        return craft?.ownership.some((owner) => owner.partnerId === partnerId) ?? false;
      })
      .filter((item) => {
        if (!needle) return true;
        const craft = getAircraft(item.aircraftId);
        const blob = [
          item.name,
          item.icao,
          item.slot,
          item.airport,
          item.manager,
          item.contract,
          item.note,
          craft?.registration,
          ...item.services,
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(needle);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [aircraftId, partnerId, query]);

  const total = hangars.reduce((sum, item) => sum + item.monthlyFee, 0);
  const renovacao = hangars.filter((item) => item.status === "renovacao").length;
  const craftAtiva =
    aircraftId !== "todas" ? listAircraft().find((item) => item.id === aircraftId) : null;
  const contextoPeriodo = [
    craftAtiva?.registration ?? (aircraftId === "todas" ? "Toda a operação" : aircraftId),
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
            <h1 className="text-[22px] font-bold tracking-tight">Hangar</h1>
            <p className="mt-0.5 text-[13px] text-tse-muted">{contextoPeriodo}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight">Hangar</h1>
            <p className="mt-0.5 text-[13px] text-tse-muted">{contextoPeriodo}</p>
          </div>
          <Link
            href="/hangar/novo"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-tse-text text-white shadow-sm md:hidden"
            aria-label="Novo hangar"
          >
            <Plus className="size-5" aria-hidden />
          </Link>
        </div>
      )}

      <FiltrosOperacao
        compacto={Boolean(partnerId)}
        legenda={partnerId ? undefined : "Onde cada aeronave fica e quanto custa o espaço."}
      />

      {!partnerId ? (
        <div className="hidden justify-end md:flex">
          <BotaoNovo href="/hangar/novo">Novo hangar</BotaoNovo>
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">
          Resumo do período
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MetricaIcone icone={Warehouse} label="Posições" value={String(hangars.length)} />
          <MetricaIcone
            icone={CircleDollarSign}
            label="Mensalidades"
            value={formatBRL(Math.round(total))}
          />
          <MetricaIcone
            icone={Clock3}
            label="Em renovação"
            value={String(renovacao)}
          />
        </div>
        <p className="mt-3 text-[12px] text-tse-muted">
          Soma das posições deste recorte. Entra no rateio pela participação de cada sócio.
        </p>
      </section>

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm">
        <label className="relative block">
          <span className="sr-only">Buscar hangar</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tse-muted"
            aria-hidden
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por hangar, ICAO ou aeronave"
            className="h-11 w-full rounded-xl border border-tse-line bg-tse-bg/40 pr-3 pl-10 text-[14px] outline-none focus:border-tse-olive"
          />
        </label>
      </section>

      {hangars.length === 0 ? (
        <p className="rounded-2xl border border-[#EEF0F3] bg-white px-4 py-8 text-center text-[13px] text-tse-muted shadow-sm">
          {query.trim() ? "Nenhum hangar com essa busca." : "Nenhum hangar neste recorte."}
        </p>
      ) : (
        <>
          <p className="text-[13px] text-tse-muted">
            {hangars.length} {hangars.length === 1 ? "posição" : "posições"} · {formatBRL(total)} / mês
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {hangars.map((hangar) => (
              <CartaoHangar key={hangar.id} hangar={hangar} podeEditar={!partnerId} />
            ))}
          </div>
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
  icone: typeof Warehouse;
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

function CartaoHangar({ hangar, podeEditar }: { hangar: Hangar; podeEditar: boolean }) {
  const craft = getAircraft(hangar.aircraftId);
  const days = daysUntil(hangar.contractUntil, HOJE);

  return (
    <article className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-tse-olive">
            <Building2 className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-bold tracking-wide text-tse-muted uppercase">
              {hangar.icao} · {hangar.slot}
            </p>
            <h2 className="mt-0.5 truncate text-[17px] font-bold">{hangar.name}</h2>
          </div>
        </div>
        <StatusBadge value={hangar.status} />
      </div>

      {hangar.note ? (
        <p className="mt-3 text-[13px] leading-5 text-tse-muted">{hangar.note}</p>
      ) : null}

      <dl className="mt-4 space-y-2.5 text-[14px]">
        <div className="flex justify-between gap-3">
          <dt className="text-tse-muted">Aeronave</dt>
          <dd>
            {craft ? (
              <Link href={`/frota/${craft.id}`} className="font-bold text-tse-olive hover:underline">
                {craft.registration}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-tse-muted">Mensalidade</dt>
          <dd className="font-bold tabular-nums">{formatBRL(hangar.monthlyFee)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-tse-muted">Contrato</dt>
          <dd className="text-right font-semibold">
            {hangar.contract}
            <span className="block text-[12px] font-normal text-tse-muted">
              até {formatDate(hangar.contractUntil)} · {days} dias
            </span>
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-tse-muted">Operador</dt>
          <dd className="font-semibold">{hangar.manager}</dd>
        </div>
      </dl>

      {hangar.services.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {hangar.services.map((service) => (
            <li
              key={service}
              className="rounded-md bg-tse-bg px-2 py-1 text-[12px] text-tse-text"
            >
              {service}
            </li>
          ))}
        </ul>
      ) : null}

      {podeEditar ? (
        <div className="mt-4 border-t border-[#EEEEEE] pt-3">
          <LinkEditar href={`/hangar/${hangar.id}/editar`} />
        </div>
      ) : null}
    </article>
  );
}
