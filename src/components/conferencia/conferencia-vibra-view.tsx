"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import {
  PageStack,
  TableWrap,
  tableClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { cn, formatBRL, formatDate, formatHours } from "@/lib/format";
import { corDoSocio } from "@/lib/labels";
import {
  conferenciaVibraPorDataDoc,
  type ConferenciaVibraLinha,
} from "@/services/conferencia";
import { getAircraft, monthsLabel, partnerShort } from "@/services/operacao";

type Coluna =
  | "data"
  | "nf"
  | "valor"
  | "trechos"
  | "tempo"
  | "litros"
  | "preco"
  | "status";

type Ordem = "asc" | "desc";

type Ordenacao = { coluna: Coluna; ordem: Ordem };

function formatLitros(value: number): string {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value)} L`;
}

function formatPrecoLitro(value: number | null): string {
  if (value == null || !(value > 0)) return "—";
  return `${new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value)}/L`;
}

function compararTexto(left: string, right: string, ordem: Ordem): number {
  const cmp = left.localeCompare(right, "pt-BR", { sensitivity: "base", numeric: true });
  return ordem === "asc" ? cmp : -cmp;
}

function compararNumero(left: number, right: number, ordem: Ordem): number {
  return ordem === "asc" ? left - right : right - left;
}

function ordenarLinhas(itens: ConferenciaVibraLinha[], ordenacao: Ordenacao): ConferenciaVibraLinha[] {
  const { coluna, ordem } = ordenacao;
  return [...itens].sort((left, right) => {
    switch (coluna) {
      case "data":
        return (
          compararTexto(left.date, right.date, ordem) ||
          compararTexto(left.numero, right.numero, "asc")
        );
      case "nf":
        return compararTexto(left.numero, right.numero, ordem);
      case "valor":
        return compararNumero(left.amount, right.amount, ordem);
      case "trechos":
        return compararNumero(left.trechos.length, right.trechos.length, ordem);
      case "tempo":
        return compararNumero(left.tempoDia, right.tempoDia, ordem);
      case "litros":
        return compararNumero(left.litrosNf, right.litrosNf, ordem);
      case "preco":
        return compararNumero(left.precoLitro ?? -1, right.precoLitro ?? -1, ordem);
      case "status":
        return compararTexto(left.status, right.status, ordem);
      default:
        return 0;
    }
  });
}

function CabecalhoOrdenavel({
  coluna,
  atual,
  onOrdenar,
  children,
  className,
}: {
  coluna: Coluna;
  atual: Ordenacao;
  onOrdenar: (coluna: Coluna) => void;
  children: ReactNode;
  className?: string;
}) {
  const ativo = atual.coluna === coluna;
  const Icone = !ativo ? ArrowUpDown : atual.ordem === "asc" ? ArrowUp : ArrowDown;
  const alinharDireita = className?.includes("text-right");
  return (
    <th className={cn(thClass, className)}>
      <button
        type="button"
        onClick={() => onOrdenar(coluna)}
        className={cn(
          "inline-flex items-center gap-1 font-bold tracking-wide uppercase",
          alinharDireita && "w-full justify-end",
        )}
        aria-sort={ativo ? (atual.ordem === "asc" ? "ascending" : "descending") : "none"}
      >
        {children}
        <Icone className={cn("size-3.5", ativo ? "text-tse-olive" : "text-tse-muted")} aria-hidden />
      </button>
    </th>
  );
}

function BadgeStatus({ status }: { status: ConferenciaVibraLinha["status"] }) {
  if (status === "sem_voo") {
    return (
      <span className="inline-flex rounded-md bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-bold text-[#EF4444]">
        Sem voo
      </span>
    );
  }
  if (status === "atencao") {
    return (
      <span className="inline-flex rounded-md bg-pos-provisionado-soft px-2 py-0.5 text-[11px] font-bold text-[#8B5E3C]">
        Atenção
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-md bg-pos-faturado-soft px-2 py-0.5 text-[11px] font-bold text-pos-faturado">
      Ok
    </span>
  );
}

export function ConferenciaVibraView() {
  useDados();
  const { aircraftId, months } = useOperacao();
  const [ordenacao, setOrdenacao] = useState<Ordenacao>({ coluna: "data", ordem: "asc" });

  const dados = useMemo(
    () => conferenciaVibraPorDataDoc(months, aircraftId),
    [months, aircraftId],
  );

  const linhas = useMemo(
    () => ordenarLinhas(dados.linhas, ordenacao),
    [dados.linhas, ordenacao],
  );

  function alternarOrdenacao(coluna: Coluna): void {
    setOrdenacao((atual) =>
      atual.coluna === coluna
        ? { coluna, ordem: atual.ordem === "asc" ? "desc" : "asc" }
        : {
            coluna,
            ordem:
              coluna === "data" || coluna === "nf" || coluna === "trechos" || coluna === "status"
                ? "asc"
                : "desc",
          },
    );
  }

  const contexto = [
    aircraftId === "todas"
      ? "Toda a operação"
      : (getAircraft(aircraftId)?.registration ?? aircraftId),
    monthsLabel(months),
  ].join(" · ");

  return (
    <PageStack>
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight">Vibra · data do documento</h1>
        <p className="mt-0.5 text-[13px] text-tse-muted">
          Só combustível · NF do dia × trechos do mesmo dia · {contexto}. Pode não fechar:
          sobra/falta no tanque ou várias cargas na mesma fatura — útil quando houver detalhe do
          abastecimento.
        </p>
      </div>

      <FiltrosOperacao legenda="Casa cada NF Vibra com os trechos da data do documento (pós-abastecimento)." />

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">
          Checagem · distância × combustível
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-[#F7F8F9] px-3 py-3">
            <p className="text-[11px] text-tse-muted">NFs Vibra</p>
            <p className="mt-1 text-[22px] leading-none font-bold tabular-nums">
              {formatBRL(dados.totalValor)}
            </p>
            <p className="mt-1 text-[12px] text-tse-muted">{dados.totalNotas} documento(s)</p>
          </div>
          <div className="rounded-xl bg-[#F7F8F9] px-3 py-3">
            <p className="text-[11px] text-tse-muted">Com voo no dia</p>
            <p className="mt-1 text-[22px] leading-none font-bold tabular-nums">{dados.comVoo}</p>
            <p className="mt-1 text-[12px] text-tse-muted">
              {dados.litrosComVoo > 0 ? formatLitros(dados.litrosComVoo) : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-[#F7F8F9] px-3 py-3">
            <p className="text-[11px] text-tse-muted">Sem voo no dia</p>
            <p className="mt-1 text-[22px] leading-none font-bold tabular-nums text-[#EF4444]">
              {dados.semVoo}
            </p>
            <p className="mt-1 text-[12px] text-tse-muted">NF sem trecho na data</p>
          </div>
          <div className="rounded-xl bg-[#F7F8F9] px-3 py-3">
            <p className="text-[11px] text-tse-muted">R$/L mediano</p>
            <p className="mt-1 text-[22px] leading-none font-bold tabular-nums">
              {formatPrecoLitro(dados.precoLitroMediano)}
            </p>
            <p className="mt-1 text-[12px] text-tse-muted">
              {dados.atencao > 0 ? `${dados.atencao} fora da faixa` : "faixa de referência"}
            </p>
          </div>
        </div>
      </section>

      {linhas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-tse-border bg-white px-4 py-8 text-center text-[13px] text-tse-muted">
          Nenhuma NF Vibra neste recorte.
        </p>
      ) : (
        <TableWrap>
          <table className={`${tableClass} min-w-[1100px]`}>
            <thead className={theadClass}>
              <tr>
                <CabecalhoOrdenavel coluna="data" atual={ordenacao} onOrdenar={alternarOrdenacao}>
                  Data doc.
                </CabecalhoOrdenavel>
                <CabecalhoOrdenavel coluna="nf" atual={ordenacao} onOrdenar={alternarOrdenacao}>
                  NF Vibra
                </CabecalhoOrdenavel>
                <CabecalhoOrdenavel
                  coluna="valor"
                  atual={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="text-right"
                >
                  Valor NF
                </CabecalhoOrdenavel>
                <CabecalhoOrdenavel coluna="trechos" atual={ordenacao} onOrdenar={alternarOrdenacao}>
                  Trechos do dia
                </CabecalhoOrdenavel>
                <CabecalhoOrdenavel
                  coluna="tempo"
                  atual={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="text-right"
                >
                  Tempo
                </CabecalhoOrdenavel>
                <CabecalhoOrdenavel
                  coluna="litros"
                  atual={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="text-right"
                >
                  Litros cálc.
                </CabecalhoOrdenavel>
                <CabecalhoOrdenavel
                  coluna="preco"
                  atual={ordenacao}
                  onOrdenar={alternarOrdenacao}
                  className="text-right"
                >
                  R$/L
                </CabecalhoOrdenavel>
                <CabecalhoOrdenavel coluna="status" atual={ordenacao} onOrdenar={alternarOrdenacao}>
                  Checagem
                </CabecalhoOrdenavel>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={linha.key} className={trClass}>
                  <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                    {formatDate(linha.date)}
                  </td>
                  <td className={tdClass}>
                    {linha.anexoUrl ? (
                      <a
                        href={linha.anexoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-tse-olive hover:underline"
                      >
                        {linha.numero}
                      </a>
                    ) : (
                      <span className="font-semibold tabular-nums">{linha.numero}</span>
                    )}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums font-semibold`}>
                    {formatBRL(linha.amount)}
                  </td>
                  <td className={`${tdClass} min-w-[220px]`}>
                    {linha.trechos.length === 0 ? (
                      <span className="text-tse-muted">—</span>
                    ) : (
                      <ul className="space-y-1">
                        {linha.trechos.map((trecho) => (
                          <li key={trecho.legId} className="leading-tight">
                            <Link
                              href={`/itinerarios/${trecho.itineraryId}`}
                              className="font-semibold text-tse-text hover:underline"
                            >
                              {trecho.route}
                            </Link>
                            <span className="mt-0.5 flex items-center gap-1 text-[11px] text-tse-muted">
                              <span
                                className="size-1.5 rounded-full"
                                style={{ background: corDoSocio(trecho.partnerId) }}
                                aria-hidden
                              />
                              {trecho.rateioParticipacao
                                ? "Participação"
                                : partnerShort(trecho.partnerId)}
                              {" · "}
                              {formatHours(trecho.blockHours)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {linha.tempoDia > 0 ? formatHours(linha.tempoDia) : "—"}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums text-tse-muted`}>
                    {linha.litrosNf > 0 ? formatLitros(linha.litrosNf) : "—"}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums font-semibold`}>
                    {formatPrecoLitro(linha.precoLitro)}
                  </td>
                  <td className={tdClass}>
                    <BadgeStatus status={linha.status} />
                    <p className="mt-1 text-[11px] text-tse-muted">{linha.detalhe}</p>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-tse-border bg-tse-bg">
                <td className={`${tdClass} font-bold`} colSpan={2}>
                  Total · {linhas.length} NF(s)
                </td>
                <td className={`${tdClass} text-right font-bold tabular-nums`}>
                  {formatBRL(dados.totalValor)}
                </td>
                <td className={tdClass} />
                <td className={tdClass} />
                <td className={`${tdClass} text-right font-bold tabular-nums text-tse-muted`}>
                  {dados.litrosComVoo > 0 ? formatLitros(dados.litrosComVoo) : "—"}
                </td>
                <td className={`${tdClass} text-right font-bold tabular-nums`}>
                  {formatPrecoLitro(dados.precoLitroMediano)}
                </td>
                <td className={tdClass} />
              </tr>
            </tfoot>
          </table>
        </TableWrap>
      )}
    </PageStack>
  );
}
