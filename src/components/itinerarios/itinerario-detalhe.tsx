"use client";

import { useParams } from "next/navigation";
import { LinkEditar } from "@/components/formularios/campos";
import { BackLink, Card, PageStack, StatusBadge } from "@/components/ui/tse";
import { useDados } from "@/hooks/use-dados";
import { formatBRL, formatDate, formatHours } from "@/lib/format";
import { CATEGORY_LABEL, PURPOSE_LABEL, ROLE_LABEL } from "@/lib/labels";
import {
  expensesOfItinerary,
  getAircraft,
  getCrew,
  getItinerary,
  partnerName,
  tripHours,
} from "@/services/operacao";

export function ItinerarioDetalhe() {
  useDados();
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const trip = getItinerary(id);

  if (!trip) {
    return (
      <PageStack>
        <BackLink href="/itinerarios">Voltar aos itinerários</BackLink>
        <Card title="Itinerário não encontrado" />
      </PageStack>
    );
  }

  const craft = getAircraft(trip.aircraftId);
  const expenses = expensesOfItinerary(trip.id);
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  const hours = tripHours(trip);

  return (
    <PageStack>
      <BackLink href="/itinerarios">Voltar aos itinerários</BackLink>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold tracking-wide text-tse-muted uppercase">
              {craft?.registration} · {PURPOSE_LABEL[trip.purpose]}
            </p>
            <h2 className="mt-1 text-[26px] font-bold tracking-tight">{trip.title}</h2>
            <p className="mt-1 max-w-2xl text-[14px] leading-6 text-tse-muted">{trip.note}</p>
          </div>
          <div className="flex items-center gap-3">
            <LinkEditar href={`/itinerarios/${trip.id}/editar`} />
            <StatusBadge value={trip.status} />
          </div>
        </div>
        {trip.conditional ? (
          <p className="mt-4 rounded-xl bg-tse-soft px-3 py-2 text-[13px] font-semibold">
            {trip.conditional}
          </p>
        ) : null}
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">Quem pediu</dt>
            <dd className="mt-1 font-semibold">{partnerName(trip.requestedBy)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">A bordo</dt>
            <dd className="mt-1 font-semibold">{trip.passengers.join(", ")}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">Horas</dt>
            <dd className="mt-1 font-semibold">
              {formatHours(hours.voadas)} voadas
              {hours.previstas > 0 ? ` · ${formatHours(hours.previstas)} previstas` : ""}
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-3">
        {trip.legs.map((leg, index) => {
          const commander = getCrew(leg.commanderId);
          const copilot = leg.copilotId ? getCrew(leg.copilotId) : undefined;
          return (
            <Card key={leg.id} title={`Trecho ${index + 1}`}>
              <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <div>
                  <p className="font-display text-[28px] tracking-wide">{leg.fromIcao}</p>
                  <p className="text-[13px] text-tse-muted">{leg.fromCity}</p>
                  <p className="mt-1 text-[13px] font-semibold">{leg.depart}</p>
                </div>
                <p className="text-center text-[13px] font-bold text-tse-gold">
                  {formatHours(leg.blockHours)}
                </p>
                <div className="sm:text-right">
                  <p className="font-display text-[28px] tracking-wide">{leg.toIcao}</p>
                  <p className="text-[13px] text-tse-muted">{leg.toCity}</p>
                  <p className="mt-1 text-[13px] font-semibold">{leg.arrive}</p>
                </div>
              </div>
              <p className="mt-4 text-[13px] text-tse-muted">
                {formatDate(leg.date)} · {commander ? `${ROLE_LABEL[commander.role]} ${commander.name}` : ""}
                {copilot ? ` · ${ROLE_LABEL[copilot.role]} ${copilot.name}` : ""}
              </p>
            </Card>
          );
        })}
      </div>

      <Card
        title="Custo deste itinerário"
        subtitle={
          trip.status === "cancelado"
            ? "Cancelado antes de gerar despesa."
            : `Entra no rateio de ${partnerName(trip.requestedBy)}.`
        }
      >
        {expenses.length === 0 ? (
          <p className="text-[13px] text-tse-muted">Sem lançamentos.</p>
        ) : (
          <ul className="divide-y divide-[#EEEEEE]">
            {expenses.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                <span>
                  <span className="block font-semibold">{item.description}</span>
                  <span className="text-tse-muted">
                    {CATEGORY_LABEL[item.category]} · {item.vendor}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-bold">{formatBRL(item.amount)}</span>
                  <StatusBadge value={item.posting} />
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between py-3 text-[15px] font-bold">
              <span>Total</span>
              <span>{formatBRL(total)}</span>
            </li>
          </ul>
        )}
      </Card>
    </PageStack>
  );
}
