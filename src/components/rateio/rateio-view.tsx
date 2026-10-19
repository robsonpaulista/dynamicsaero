"use client";

import Link from "next/link";
import { BotaoNovo, LinkEditar } from "@/components/formularios/campos";
import { ContaCorrentePainel } from "@/components/rateio/conta-corrente";
import { RelatoriosRateio } from "@/components/rateio/relatorios-rateio";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import {
  Card,
  PageStack,
  tableClass,
  TableWrap,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { formatBRL, formatDate, formatHours } from "@/lib/format";
import { corDoSocio, CATEGORY_LABEL, METODO_LABEL } from "@/lib/labels";
import {
  getAircraft,
  getRateio,
  listAportes,
  monthLabel,
  partnerName,
  partnerShort,
  VIEWER_ID,
} from "@/services/operacao";

export function RateioView() {
  useDados();
  const { aircraftId, month } = useOperacao();
  const rateio = getRateio(month, aircraftId);
  const aircraft = rateio.partners[0]?.byAircraft.map((item) => item.aircraftId) ?? [];
  const aportes = listAportes(month).filter(
    (item) => aircraftId === "todas" || item.aircraftId === null || item.aircraftId === aircraftId,
  );

  return (
    <PageStack>
      <FiltrosOperacao legenda={`Competência de ${monthLabel(month).toLowerCase()}.`} />
      <Card title="A regra, em duas linhas">
        <div className="grid gap-3 md:grid-cols-2">
          <Regra
            titulo="Estrutura e manutenção"
            texto="Hangar, seguro, folha e oficina seguem a participação de cada sócio na aeronave."
          />
          <Regra
            titulo="O voo em si"
            texto="Combustível, taxas, pátio e catering ficam com quem pediu o itinerário — mesmo que outro sócio vá a bordo."
          />
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Numero label="Comprometido" value={formatBRL(rateio.total)} />
        <Numero label="Já aportado" value={formatBRL(rateio.pago)} />
        <Numero label="Ainda em aberto" value={formatBRL(rateio.saldo)} destaque />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {rateio.partners.map((item) => (
          <article key={item.partnerId} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-bold">
                <span
                  className="mr-2 inline-block size-2.5 rounded-full"
                  style={{ background: corDoSocio(item.partnerId) }}
                />
                {partnerShort(item.partnerId)}
                {item.partnerId === VIEWER_ID ? (
                  <span className="ml-2 text-[11px] font-bold tracking-wide text-tse-gold uppercase">
                    Você
                  </span>
                ) : null}
              </h2>
              {item.saldo <= 1 ? (
                <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-bold tracking-wide text-[#334155] uppercase">
                  Em dia
                </span>
              ) : (
                <span className="rounded-md bg-tse-soft px-2 py-0.5 text-[11px] font-bold tracking-wide text-[#0369A1] uppercase">
                  Em aberto
                </span>
              )}
            </div>
            <p className="mt-3 text-[28px] font-bold tracking-tight">
              {item.saldo <= 1 ? formatBRL(0) : formatBRL(item.saldo)}
            </p>
            <p className="text-[12px] text-tse-muted">saldo a aportar</p>
            <dl className="mt-4 space-y-1.5 text-[13px]">
              <Linha rotulo="Pela participação" valor={formatBRL(item.participacao)} />
              <Linha rotulo="Pelos voos pedidos" valor={formatBRL(item.voos)} />
              <Linha rotulo="Total do mês" valor={formatBRL(item.total)} />
              <Linha rotulo="Já pago" valor={formatBRL(item.pago)} />
              <Linha rotulo="Horas pedidas" valor={formatHours(item.hours)} />
            </dl>
          </article>
        ))}
      </div>

      <ContaCorrentePainel month={month} aircraftId={aircraftId} partners={rateio.partners} />

      <Card
        title="Por aeronave"
        subtitle={
          rateio.fecha
            ? "A soma dos sócios fecha com as despesas do mês."
            : "Há diferença de centavos a revisar."
        }
      >
        <TableWrap>
          <table className={tableClass}>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Aeronave</th>
                {rateio.partners.map((item) => (
                  <th key={item.partnerId} className={thClass}>
                    {partnerShort(item.partnerId)}
                  </th>
                ))}
                <th className={thClass}>Total</th>
              </tr>
            </thead>
            <tbody>
              {aircraft.map((id) => {
                const craft = getAircraft(id);
                const cells = rateio.partners.map(
                  (partner) => partner.byAircraft.find((slice) => slice.aircraftId === id)?.total ?? 0,
                );
                const rowTotal = cells.reduce((sum, value) => sum + value, 0);
                return (
                  <tr key={id} className={trClass}>
                    <td className={tdClass}>
                      <Link href={`/frota/${id}`} className="font-bold hover:underline">
                        {craft?.registration}
                      </Link>
                    </td>
                    {cells.map((value, index) => (
                      <td key={rateio.partners[index]?.partnerId ?? index} className={tdClass}>
                        {value > 0 ? formatBRL(value) : "—"}
                      </td>
                    ))}
                    <td className={`${tdClass} font-bold`}>{formatBRL(rowTotal)}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-[#DDDDDD] font-bold">
                <td className={tdClass}>Total</td>
                {rateio.partners.map((item) => (
                  <td key={item.partnerId} className={tdClass}>
                    {formatBRL(item.total)}
                  </td>
                ))}
                <td className={tdClass}>{formatBRL(rateio.total)}</td>
              </tr>
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="O que cada um está pagando">
          <ul className="space-y-4">
            {rateio.partners.map((item) => (
              <li key={item.partnerId}>
                <p className="text-[14px] font-bold">{partnerName(item.partnerId)}</p>
                <ul className="mt-1 space-y-1">
                  {item.byCategory.map((category) => (
                    <li key={category.category} className="flex justify-between gap-3 text-[13px]">
                      <span className="text-tse-muted">{CATEGORY_LABEL[category.category]}</span>
                      <span>{formatBRL(category.amount)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="O que já entrou" subtitle="A soma dos aportes desta competência, no recorte escolhido.">
          <ul className="space-y-3">
            {rateio.partners.map((item) => (
              <li key={item.partnerId} className="rounded-xl bg-tse-bg px-3 py-3">
                <p className="text-[14px] font-bold">{partnerName(item.partnerId)}</p>
                {item.aportes.length === 0 ? (
                  <p className="mt-1 text-[13px] text-tse-muted">Nenhum aporte neste mês.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {item.aportes.map((aporte) => (
                      <li key={aporte.id} className="text-[13px] text-tse-muted">
                        {formatDate(aporte.date)} · {aporte.note} ·{" "}
                        <span className="font-bold text-tse-text">{formatBRL(aporte.aplicado)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-[12px]">
            <div>
              <dt className="text-tse-muted">Realizado</dt>
              <dd className="font-bold">{formatBRL(rateio.realizado)}</dd>
            </div>
            <div>
              <dt className="text-tse-muted">Previsto</dt>
              <dd className="font-bold">{formatBRL(rateio.previsto)}</dd>
            </div>
            <div>
              <dt className="text-tse-muted">Provisionado</dt>
              <dd className="font-bold">{formatBRL(rateio.provisionado)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card
        title="Aportes"
        subtitle="Cada pagamento abate o saldo do cotista. A operação inteira entra na proporção da conta quando o filtro é uma aeronave."
        action={<BotaoNovo href="/rateio/aportes/novo">Novo aporte</BotaoNovo>}
      >
        {aportes.length === 0 ? (
          <p className="text-[13px] text-tse-muted">Nenhum aporte nesta competência.</p>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Data</th>
                  <th className={thClass}>Cotista</th>
                  <th className={thClass}>Forma</th>
                  <th className={thClass}>Referência</th>
                  <th className={thClass}>Escopo</th>
                  <th className={thClass}>Valor</th>
                  <th className={thClass}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {aportes.map((item) => (
                  <tr key={item.id} className={trClass}>
                    <td className={tdClass}>{formatDate(item.date)}</td>
                    <td className={tdClass}>{partnerName(item.partnerId)}</td>
                    <td className={tdClass}>{METODO_LABEL[item.method]}</td>
                    <td className={tdClass}>{item.reference || "—"}</td>
                    <td className={tdClass}>
                      {item.aircraftId ? (getAircraft(item.aircraftId)?.registration ?? item.aircraftId) : "Operação"}
                    </td>
                    <td className={`${tdClass} font-bold`}>{formatBRL(item.amount)}</td>
                    <td className={tdClass}>
                      <LinkEditar href={`/rateio/aportes/${item.id}/editar`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <RelatoriosRateio month={month} aircraftId={aircraftId} />
    </PageStack>
  );
}

function Regra({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-xl bg-tse-bg px-4 py-3">
      <h3 className="text-[14px] font-bold">{titulo}</h3>
      <p className="mt-1 text-[13px] leading-5 text-tse-muted">{texto}</p>
    </div>
  );
}

function Numero({
  label,
  value,
  destaque,
}: {
  label: string;
  value: string;
  destaque?: boolean;
}) {
  return (
    <article className={`rounded-2xl bg-white p-4 shadow-sm ${destaque ? "border-t-4 border-t-tse-yellow" : ""}`}>
      <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">{label}</p>
      <p className="mt-2 text-[26px] font-bold tracking-tight">{value}</p>
    </article>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-tse-muted">{rotulo}</dt>
      <dd className="font-semibold">{valor}</dd>
    </div>
  );
}
