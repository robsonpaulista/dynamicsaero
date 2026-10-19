"use client";

import Link from "next/link";
import { useState } from "react";
import { BotaoNovo } from "@/components/formularios/campos";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import {
  Card,
  EmptyState,
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
import { formatBRL, formatDateShort } from "@/lib/format";
import { ALLOCATION_LABEL, CATEGORY_LABEL, categoryBarColor } from "@/lib/labels";
import {
  custosPorCategoria,
  expensesIn,
  getAircraft,
  getKpis,
  hrefOrigem,
} from "@/services/operacao";
import type { Expense } from "@/types/operacao";

type Recorte = "todas" | "voo" | "estrutura" | "manutencao";

function passaRecorte(expense: Expense, recorte: Recorte): boolean {
  if (recorte === "todas") return true;
  if (recorte === "manutencao") return expense.category === "manutencao";
  if (recorte === "voo") return expense.allocation === "solicitante";
  return expense.allocation === "participacao" && expense.category !== "manutencao";
}

const ABAS: { id: Recorte; label: string }[] = [
  { id: "todas", label: "Tudo" },
  { id: "voo", label: "Voos" },
  { id: "estrutura", label: "Estrutura" },
  { id: "manutencao", label: "Manutenção" },
];

export function DespesasView() {
  useDados();
  const { aircraftId, month } = useOperacao();
  const [recorte, setRecorte] = useState<Recorte>("todas");
  const kpis = getKpis(month, aircraftId);
  const categorias = custosPorCategoria(month, aircraftId);
  const maior = categorias[0]?.amount ?? 1;
  const rows = expensesIn(month, aircraftId)
    .filter((item) => passaRecorte(item, recorte))
    .sort((left, right) => right.date.localeCompare(left.date) || right.amount - left.amount);
  const total = rows.reduce((sum, item) => sum + item.amount, 0);

  return (
    <PageStack>
      <FiltrosOperacao legenda="O mês inteiro: o que já aconteceu, o que está previsto e o que está provisionado." />
      <div className="flex justify-end">
        <BotaoNovo href="/despesas/nova">Nova despesa</BotaoNovo>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Resumo label="Comprometido" value={formatBRL(kpis.custoComprometido)} />
        <Resumo label="Realizado" value={formatBRL(kpis.custoRealizado)} />
        <Resumo
          label="Ainda à frente"
          value={formatBRL(kpis.custoComprometido - kpis.custoRealizado)}
        />
      </div>
      <Card title="Por natureza">
        <ul className="space-y-3">
          {categorias.map((item) => (
            <li key={item.category} className="grid grid-cols-[120px_1fr_auto] items-center gap-3 text-[13px]">
              <span>{CATEGORY_LABEL[item.category]}</span>
              <span className="h-2 overflow-hidden rounded-full bg-tse-bg">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.max(4, (item.amount / maior) * 100)}%`,
                    background: categoryBarColor(item.category),
                  }}
                />
              </span>
              <span className="font-bold">{formatBRL(item.amount)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <div className="flex flex-wrap gap-5 border-b border-tse-border text-[12px] font-bold tracking-wide uppercase">
        {ABAS.map((aba) => (
          <button
            key={aba.id}
            type="button"
            aria-pressed={recorte === aba.id}
            onClick={() => setRecorte(aba.id)}
            className={`-mb-px border-b-2 pb-2 ${
              recorte === aba.id
                ? "border-tse-yellow text-tse-gold"
                : "border-transparent text-tse-muted"
            }`}
          >
            {aba.label}
          </button>
        ))}
      </div>
      <p className="text-[13px] text-tse-muted">
        {rows.length} lançamentos · {formatBRL(total)}
      </p>
      {rows.length === 0 ? (
        <EmptyState>Nenhuma despesa neste recorte.</EmptyState>
      ) : (
        <TableWrap>
          <table className={tableClass}>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Data</th>
                <th className={thClass}>Lançamento</th>
                <th className={thClass}>Aeronave</th>
                <th className={thClass}>Natureza</th>
                <th className={thClass}>Rateio</th>
                <th className={thClass}>Situação</th>
                <th className={thClass}>Valor</th>
                <th className={thClass}>Origem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const craft = getAircraft(item.aircraftId);
                const href = item.itineraryId
                  ? `/itinerarios/${item.itineraryId}`
                  : item.maintenanceId
                    ? `/manutencao/${item.maintenanceId}`
                    : null;
                return (
                  <tr key={item.id} className={trClass}>
                    <td className={tdClass}>{formatDateShort(item.date)}</td>
                    <td className={tdClass}>
                      {href ? (
                        <Link href={href} className="font-bold hover:underline">
                          {item.description}
                        </Link>
                      ) : (
                        <span className="font-bold">{item.description}</span>
                      )}
                      <span className="block text-[12px] text-tse-muted">{item.vendor}</span>
                    </td>
                    <td className={tdClass}>{craft?.registration}</td>
                    <td className={tdClass}>{CATEGORY_LABEL[item.category]}</td>
                    <td className={tdClass}>{ALLOCATION_LABEL[item.allocation]}</td>
                    <td className={tdClass}>
                      <StatusBadge value={item.posting} />
                    </td>
                    <td className={`${tdClass} font-bold`}>{formatBRL(item.amount)}</td>
                    <td className={tdClass}>
                      <Link href={hrefOrigem(item)} className="text-[12px] font-bold tracking-wide text-tse-olive uppercase hover:underline">
                        {item.manual ? "Editar" : "Abrir"}
                      </Link>
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

function Resumo({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">{label}</p>
      <p className="mt-2 text-[24px] font-bold tracking-tight">{value}</p>
    </article>
  );
}
