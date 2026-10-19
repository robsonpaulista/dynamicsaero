"use client";

import { useState } from "react";
import { Card, tableClass, tdClass, thClass } from "@/components/ui/tse";
import { formatBRL, formatDate } from "@/lib/format";
import { contaCorrente, partnerName, VIEWER_ID } from "@/services/operacao";
import type { RateioPartner } from "@/types/operacao";

export function ContaCorrentePainel({
  month,
  aircraftId,
  partners,
}: {
  month: string;
  aircraftId: string;
  partners: RateioPartner[];
}) {
  const [escolhido, setEscolhido] = useState<string>(VIEWER_ID);
  const cotista = partners.some((item) => item.partnerId === escolhido)
    ? escolhido
    : (partners[0]?.partnerId ?? "");
  if (!cotista) return null;

  const conta = contaCorrente(cotista, month, aircraftId);
  const situacao = conta.saldo > 1 ? "Em aberto" : conta.saldo < -1 ? "Crédito" : "Em dia";

  return (
    <Card
      title={`Conta corrente · ${partnerName(cotista)}`}
      subtitle="Cada despesa entra como débito. Cada aporte entra como crédito. O saldo corre linha a linha; quando fica positivo, é o que ainda falta pagar."
      action={
        <label className="block min-w-44 text-[12px] font-bold tracking-wide text-tse-muted uppercase">
          Cotista
          <select
            value={cotista}
            onChange={(event) => setEscolhido(event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-tse-border bg-white px-2 text-[13px] font-semibold text-tse-text normal-case outline-none"
          >
            {partners.map((item) => (
              <option key={item.partnerId} value={item.partnerId}>
                {partnerName(item.partnerId)}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Resumo rotulo="Saldo anterior" valor={formatBRL(conta.saldoAnterior)} />
        <Resumo rotulo="Débitos" valor={formatBRL(conta.debitos)} tom="debito" />
        <Resumo rotulo="Créditos" valor={formatBRL(conta.creditos)} tom="credito" />
        <Resumo rotulo={`Saldo · ${situacao}`} valor={formatBRL(conta.saldo)} destaque={conta.saldo > 1} />
      </div>
      <ul className="max-h-[520px] space-y-2 overflow-auto md:hidden">
        <li className="flex items-center justify-between gap-3 rounded-xl bg-[#F4F4F2] px-3 py-2 font-bold">
          <span>Saldo anterior</span>
          <span>{formatBRL(conta.saldoAnterior)}</span>
        </li>
        {conta.lancamentos.length === 0 ? (
          <li className="px-3 py-2 text-[13px] text-tse-muted">Nenhum movimento nesta competência.</li>
        ) : (
          conta.lancamentos.map((item) => (
            <li key={item.id} className="rounded-xl border border-[#EEEEEE] px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[12px] text-tse-muted">{formatDate(item.date)}</p>
                <p className="text-[13px] font-bold whitespace-nowrap">{formatBRL(item.saldo)}</p>
              </div>
              <p className="mt-1 text-[13px] leading-5">{item.historico}</p>
              <p
                className={`mt-1 text-right text-[13px] font-semibold ${
                  item.natureza === "credito" ? "text-tse-olive" : "text-[#EF4444]"
                }`}
              >
                {item.natureza === "debito" ? "Débito" : "Crédito"} {formatBRL(item.valor)}
              </p>
            </li>
          ))
        )}
        <li className="rounded-xl bg-[#F4F4F2] px-3 py-2 text-[13px] font-bold">
          <div className="flex justify-between gap-3 text-[#EF4444]">
            <span>Débitos</span>
            <span>{formatBRL(conta.debitos)}</span>
          </div>
          <div className="mt-1 flex justify-between gap-3 text-tse-olive">
            <span>Créditos</span>
            <span>{formatBRL(conta.creditos)}</span>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span>Saldo da conta</span>
            <span>{formatBRL(conta.saldo)}</span>
          </div>
        </li>
      </ul>
      <div className="hidden max-h-[520px] overflow-auto rounded-xl border border-[#EEEEEE] md:block">
        <table className={tableClass}>
          <thead className="sticky top-0 z-10 bg-[#F7F7F5] text-[11px] font-bold tracking-wide text-tse-muted uppercase">
            <tr>
              <th className={thClass}>Data</th>
              <th className={thClass}>Histórico</th>
              <th className={`${thClass} text-right text-[#EF4444]`}>Débito</th>
              <th className={`${thClass} text-right text-tse-olive`}>Crédito</th>
              <th className={`${thClass} text-right`}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-[#F4F4F2] font-bold">
              <td className={tdClass} />
              <td className={tdClass}>Saldo anterior</td>
              <td className={`${tdClass} text-right text-tse-muted`}>—</td>
              <td className={`${tdClass} text-right text-tse-muted`}>—</td>
              <td className={`${tdClass} text-right`}>{formatBRL(conta.saldoAnterior)}</td>
            </tr>
            {conta.lancamentos.length === 0 ? (
              <tr>
                <td className={`${tdClass} text-tse-muted`} colSpan={5}>
                  Nenhum movimento nesta competência.
                </td>
              </tr>
            ) : (
              conta.lancamentos.map((item) => (
                <tr key={item.id} className="border-t border-[#EEEEEE]">
                  <td className={`${tdClass} whitespace-nowrap`}>{formatDate(item.date)}</td>
                  <td className={tdClass}>{item.historico}</td>
                  <td
                    className={`${tdClass} text-right whitespace-nowrap ${
                      item.natureza === "debito" ? "text-[#EF4444]" : "text-tse-muted"
                    }`}
                  >
                    {item.natureza === "debito" ? formatBRL(item.valor) : "—"}
                  </td>
                  <td
                    className={`${tdClass} text-right whitespace-nowrap ${
                      item.natureza === "credito" ? "text-tse-olive" : "text-tse-muted"
                    }`}
                  >
                    {item.natureza === "credito" ? formatBRL(item.valor) : "—"}
                  </td>
                  <td className={`${tdClass} text-right font-semibold whitespace-nowrap`}>
                    {formatBRL(item.saldo)}
                  </td>
                </tr>
              ))
            )}
            <tr className="border-t border-[#DDDDDD] bg-[#F4F4F2] font-bold">
              <td className={tdClass} />
              <td className={tdClass}>Saldo da conta</td>
              <td className={`${tdClass} text-right text-[#EF4444]`}>{formatBRL(conta.debitos)}</td>
              <td className={`${tdClass} text-right text-tse-olive`}>{formatBRL(conta.creditos)}</td>
              <td className={`${tdClass} text-right`}>{formatBRL(conta.saldo)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Resumo({
  rotulo,
  valor,
  destaque,
  tom,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
  tom?: "debito" | "credito";
}) {
  const cor = tom === "debito" ? "text-[#EF4444]" : tom === "credito" ? "text-tse-olive" : "";
  return (
    <div className={`rounded-xl bg-tse-bg px-3 py-2 ${destaque ? "border-t-2 border-t-tse-yellow" : ""}`}>
      <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">{rotulo}</p>
      <p className={`mt-1 text-[16px] font-bold tracking-tight ${cor}`}>{valor}</p>
    </div>
  );
}
