"use client";

import Link from "next/link";
import { BotaoNovo, LinkEditar } from "@/components/formularios/campos";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import {
  Card,
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
} from "@/services/operacao";

export function FrotaView() {
  useDados();
  const { aircraftId, month } = useOperacao();
  const fleet = listAircraft().filter((item) => matchesAircraft(item.id, aircraftId));
  const kpis = getKpis(month, aircraftId);

  return (
    <PageStack>
      <FiltrosOperacao legenda="A frota inteira, com o custo do mês escolhido." />
      <div className="flex justify-end">
        <BotaoNovo href="/frota/nova">Nova aeronave</BotaoNovo>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {fleet.map((item) => {
          const uso = aircraftMonth(item.id, month);
          return (
            <Link
              key={item.id}
              href={`/frota/${item.id}`}
              className="rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-[28px] tracking-wide">{item.registration}</p>
                <StatusBadge value={item.status} />
              </div>
              <p className="mt-1 text-[15px] font-semibold">
                {item.manufacturer} {item.model}
              </p>
              <p className="text-[13px] text-tse-muted">
                {CATEGORY_TONE[item.category]} · {item.year} · {item.seats} lugares
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <dt className="text-tse-muted">Base</dt>
                  <dd className="font-semibold">
                    {item.baseName} · {item.baseIcao}
                  </dd>
                </div>
                <div>
                  <dt className="text-tse-muted">Célula</dt>
                  <dd className="font-semibold">{formatHours(item.totalHours)}</dd>
                </div>
                <div>
                  <dt className="text-tse-muted">No mês</dt>
                  <dd className="font-semibold">{formatHours(uso.voadas + uso.previstas)}</dd>
                </div>
                <div>
                  <dt className="text-tse-muted">Custo do mês</dt>
                  <dd className="font-semibold">{formatBRL(uso.custo)}</dd>
                </div>
              </dl>
              <div className="mt-4">
                <OwnershipBar aircraftId={item.id} />
              </div>
            </Link>
          );
        })}
      </div>

      <Card title="Comparar" subtitle={`${kpis.prontas} de ${kpis.totalAeronaves} disponíveis agora.`}>
        <TableWrap>
          <table className={tableClass}>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Aeronave</th>
                <th className={thClass}>Situação</th>
                <th className={thClass}>Horas voadas</th>
                <th className={thClass}>Horas previstas</th>
                <th className={thClass}>Custo do mês</th>
                <th className={thClass}>Ciclos</th>
                <th className={thClass}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {fleet.map((item) => {
                const uso = aircraftMonth(item.id, month);
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
                    <td className={tdClass}>{formatHours(uso.voadas)}</td>
                    <td className={tdClass}>{formatHours(uso.previstas)}</td>
                    <td className={tdClass}>{formatBRL(uso.custo)}</td>
                    <td className={tdClass}>{item.cycles.toLocaleString("pt-BR")}</td>
                    <td className={tdClass}>
                      <LinkEditar href={`/frota/${item.id}/editar`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </PageStack>
  );
}
