"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { LinkEditar } from "@/components/formularios/campos";
import { BackLink, Card, OwnershipBar, PageStack, StatusBadge } from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { formatBRL, formatHours, formatPercent } from "@/lib/format";
import { CATEGORY_TONE, ROLE_LABEL } from "@/lib/labels";
import {
  aircraftMonth,
  crewOnAircraft,
  getAircraft,
  hangarOf,
  itinerariesIn,
  itineraryCities,
  maintenanceOf,
  monthLabel,
  partnerName,
} from "@/services/operacao";

export function AeronaveDetalhe() {
  useDados();
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const aircraft = getAircraft(id);
  const { month } = useOperacao();

  if (!aircraft) {
    return (
      <PageStack>
        <BackLink href="/frota">Voltar à frota</BackLink>
        <Card title="Aeronave não encontrada">
          <p className="text-[13px] text-tse-muted">Esse registro não está na demonstração.</p>
        </Card>
      </PageStack>
    );
  }

  const uso = aircraftMonth(aircraft.id, month);
  const hangar = hangarOf(aircraft.id);
  const crew = crewOnAircraft(aircraft.id);
  const maintenance = maintenanceOf(aircraft.id);
  const trips = itinerariesIn(month, aircraft.id);

  return (
    <PageStack>
      <BackLink href="/frota">Voltar à frota</BackLink>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-[32px] tracking-wide">{aircraft.registration}</p>
            <h2 className="text-[18px] font-bold">
              {aircraft.manufacturer} {aircraft.model}
            </h2>
            <p className="text-[13px] text-tse-muted">
              {CATEGORY_TONE[aircraft.category]} · série {aircraft.serial} · {aircraft.year}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LinkEditar href={`/frota/${aircraft.id}/editar`} />
            <StatusBadge value={aircraft.status} />
          </div>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Ficha rotulo="Base" valor={`${aircraft.baseName} · ${aircraft.baseIcao}`} />
          <Ficha rotulo="Propulsão" valor={aircraft.propulsion} />
          <Ficha rotulo="Alcance de catálogo" valor={aircraft.range} />
          <Ficha rotulo="Lugares" valor={String(aircraft.seats)} />
          <Ficha rotulo="Célula" valor={formatHours(aircraft.totalHours)} />
          <Ficha rotulo="Ciclos" valor={aircraft.cycles.toLocaleString("pt-BR")} />
          <Ficha rotulo={`Horas em ${monthLabel(month)}`} valor={formatHours(uso.voadas + uso.previstas)} />
          <Ficha rotulo="Custo do mês" valor={formatBRL(uso.custo)} />
        </dl>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Participação">
          <OwnershipBar aircraftId={aircraft.id} />
          <ul className="mt-4 space-y-2 text-[13px]">
            {aircraft.ownership.map((item) => (
              <li key={item.partnerId} className="flex justify-between gap-3">
                <span>{partnerName(item.partnerId)}</span>
                <span className="font-bold">{formatPercent(item.share)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Hangar" subtitle={hangar?.note}>
          {hangar ? (
            <dl className="space-y-2 text-[14px]">
              <Linha rotulo="Local" valor={`${hangar.name} · ${hangar.slot}`} />
              <Linha rotulo="Contrato" valor={hangar.contract} />
              <Linha rotulo="Mensalidade" valor={formatBRL(hangar.monthlyFee)} />
              <Linha rotulo="Situação" valor={<StatusBadge value={hangar.status} />} />
            </dl>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Quem cuida">
          <ul className="divide-y divide-[#EEEEEE]">
            {crew.map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                <span>
                  <span className="block font-bold">{person.name}</span>
                  <span className="text-tse-muted">{person.nextDuty}</span>
                </span>
                <span className="text-[12px] font-bold tracking-wide text-tse-muted uppercase">
                  {ROLE_LABEL[person.role]}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Manutenção desta célula" action={<Link href="/manutencao" className="text-[12px] font-bold tracking-wide text-tse-olive uppercase">Programa</Link>}>
          <ul className="divide-y divide-[#EEEEEE]">
            {maintenance.map((item) => (
              <li key={item.id}>
                <Link href={`/manutencao/${item.id}`} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="block text-[14px] font-bold">{item.title}</span>
                    <span className="text-[12px] text-tse-muted">{item.dueLabel}</span>
                  </span>
                  <StatusBadge value={item.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title={`Itinerários de ${monthLabel(month)}`}>
        {trips.length === 0 ? (
          <p className="text-[13px] text-tse-muted">Nenhum itinerário neste mês.</p>
        ) : (
          <ul className="divide-y divide-[#EEEEEE]">
            {trips.map((trip) => (
              <li key={trip.id}>
                <Link href={`/itinerarios/${trip.id}`} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="block text-[14px] font-bold">{trip.title}</span>
                    <span className="text-[12px] text-tse-muted">{itineraryCities(trip)}</span>
                  </span>
                  <StatusBadge value={trip.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageStack>
  );
}

function Ficha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">{rotulo}</dt>
      <dd className="mt-1 text-[14px] font-semibold">{valor}</dd>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-tse-muted">{rotulo}</dt>
      <dd className="text-right font-semibold">{valor}</dd>
    </div>
  );
}
