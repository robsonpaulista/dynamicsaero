"use client";

import Link from "next/link";
import { useState } from "react";
import { BotaoNovo, LinkEditar } from "@/components/formularios/campos";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import {
  EmptyState,
  PageStack,
  SelectField,
  StatusBadge,
  tableClass,
  TableWrap,
  tdClass,
  TextField,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { formatDateShort, formatHours } from "@/lib/format";
import { PURPOSE_LABEL } from "@/lib/labels";
import {
  expensesOfItinerary,
  getAircraft,
  itinerariesIn,
  itineraryCities,
  itineraryRoute,
  itinerarySpan,
  partnerShort,
  tripHours,
} from "@/services/operacao";
import type { ItineraryStatus, Purpose } from "@/types/operacao";

export function ItinerariosView() {
  useDados();
  const { aircraftId, month } = useOperacao();
  const [purpose, setPurpose] = useState<string>("todas");
  const [status, setStatus] = useState<string>("todas");
  const [query, setQuery] = useState<string>("");

  const needle = query.trim().toLowerCase();
  const trips = itinerariesIn(month, aircraftId)
    .filter((trip) => purpose === "todas" || trip.purpose === (purpose as Purpose))
    .filter((trip) => status === "todas" || trip.status === (status as ItineraryStatus))
    .filter((trip) => {
      if (!needle) return true;
      const blob = [
        trip.title,
        trip.note,
        itineraryCities(trip),
        itineraryRoute(trip),
        ...trip.passengers,
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(needle);
    })
    .sort((left, right) => (right.legs[0]?.date ?? "").localeCompare(left.legs[0]?.date ?? ""));

  const horas = trips.reduce((sum, trip) => {
    const hours = tripHours(trip);
    return sum + hours.voadas + hours.previstas;
  }, 0);

  return (
    <PageStack>
      <FiltrosOperacao legenda="Cada linha é uma ida e, quando há, a volta." />
      <div className="flex justify-end">
        <BotaoNovo href="/itinerarios/novo">Novo voo</BotaoNovo>
      </div>
      <div className="flex flex-wrap gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm sm:px-5">
        <SelectField label="Finalidade" value={purpose} onChange={setPurpose}>
          <option value="todas">Todas</option>
          <option value="negocios">Negócios</option>
          <option value="pessoal">Pessoal</option>
        </SelectField>
        <SelectField label="Situação" value={status} onChange={setStatus}>
          <option value="todas">Todas</option>
          <option value="em_voo">Em voo</option>
          <option value="confirmado">Confirmado</option>
          <option value="previsto">Previsto</option>
          <option value="concluido">Concluído</option>
          <option value="cancelado">Cancelado</option>
        </SelectField>
        <TextField
          label="Busca"
          value={query}
          onChange={setQuery}
          placeholder="Cidade, passageiro, título"
        />
      </div>
      <p className="text-[13px] text-tse-muted">
        {trips.length} itinerário{trips.length === 1 ? "" : "s"} · {formatHours(horas)} no recorte
      </p>
      {trips.length === 0 ? (
        <EmptyState>Nada encontrado com esses filtros.</EmptyState>
      ) : (
        <TableWrap>
          <table className={tableClass}>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Quando</th>
                <th className={thClass}>Itinerário</th>
                <th className={thClass}>Aeronave</th>
                <th className={thClass}>Pediu</th>
                <th className={thClass}>Horas</th>
                <th className={thClass}>Custo</th>
                <th className={thClass}>Situação</th>
                <th className={thClass}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => {
                const span = itinerarySpan(trip);
                const hours = tripHours(trip);
                const cost = expensesOfItinerary(trip.id).reduce((sum, item) => sum + item.amount, 0);
                const craft = getAircraft(trip.aircraftId);
                return (
                  <tr key={trip.id} className={trClass}>
                    <td className={tdClass}>
                      {span
                        ? span.first === span.last
                          ? formatDateShort(span.first)
                          : `${formatDateShort(span.first)}–${formatDateShort(span.last)}`
                        : "—"}
                    </td>
                    <td className={tdClass}>
                      <Link href={`/itinerarios/${trip.id}`} className="font-bold hover:underline">
                        {trip.title}
                      </Link>
                      <span className="block text-[12px] text-tse-muted">
                        {itineraryRoute(trip)} · {PURPOSE_LABEL[trip.purpose]}
                      </span>
                    </td>
                    <td className={tdClass}>{craft?.registration}</td>
                    <td className={tdClass}>{partnerShort(trip.requestedBy)}</td>
                    <td className={tdClass}>{formatHours(hours.voadas + hours.previstas)}</td>
                    <td className={tdClass}>
                      {trip.status === "cancelado"
                        ? "—"
                        : cost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className={tdClass}>
                      <StatusBadge value={trip.status} />
                    </td>
                    <td className={tdClass}>
                      <LinkEditar href={`/itinerarios/${trip.id}/editar`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
    </PageStack>
  );
}
