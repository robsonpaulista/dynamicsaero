"use client";

import Link from "next/link";
import { BotaoNovo, LinkEditar } from "@/components/formularios/campos";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import { Card, PageStack, StatusBadge } from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { daysUntil, formatBRL, formatDate } from "@/lib/format";
import { getAircraft, HOJE, listHangars, matchesAircraft } from "@/services/operacao";

export function HangarView() {
  useDados();
  const { aircraftId } = useOperacao();
  const hangars = listHangars().filter((item) => matchesAircraft(item.aircraftId, aircraftId));
  const total = hangars.reduce((sum, item) => sum + item.monthlyFee, 0);

  return (
    <PageStack>
      <FiltrosOperacao legenda="Onde cada aeronave fica e quanto custa o espaço." />
      <div className="flex justify-end">
        <BotaoNovo href="/hangar/novo">Novo hangar</BotaoNovo>
      </div>
      <article className="rounded-2xl border-t-4 border-t-tse-yellow bg-white p-5 shadow-sm">
        <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">
          Hangar no mês
        </p>
        <p className="mt-2 text-[32px] font-bold tracking-tight">{formatBRL(total)}</p>
        <p className="mt-1 text-[13px] text-tse-muted">
          Soma das posições deste recorte. Entra no rateio pela participação de cada sócio.
        </p>
      </article>
      <div className="grid gap-3 lg:grid-cols-3">
        {hangars.map((hangar) => {
          const craft = getAircraft(hangar.aircraftId);
          const days = daysUntil(hangar.contractUntil, HOJE);
          return (
            <Card key={hangar.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-bold tracking-wide text-tse-gold uppercase">
                    {hangar.icao} · {hangar.slot}
                  </p>
                  <h2 className="mt-1 text-[18px] font-bold">{hangar.name}</h2>
                </div>
                <StatusBadge value={hangar.status} />
              </div>
              <p className="mt-3 text-[13px] leading-5 text-tse-muted">{hangar.note}</p>
              <dl className="mt-4 space-y-2 text-[14px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-tse-muted">Aeronave</dt>
                  <dd>
                    {craft ? (
                      <Link href={`/frota/${craft.id}`} className="font-bold text-tse-olive hover:underline">
                        {craft.registration}
                      </Link>
                    ) : null}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-tse-muted">Mensalidade</dt>
                  <dd className="font-bold">{formatBRL(hangar.monthlyFee)}</dd>
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
              <div className="mt-4">
                <LinkEditar href={`/hangar/${hangar.id}/editar`} />
              </div>
            </Card>
          );
        })}
      </div>
    </PageStack>
  );
}
