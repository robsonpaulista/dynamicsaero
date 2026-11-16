"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
import { formatBRL, formatDateLista, formatHours } from "@/lib/format";
import { corDoSocio } from "@/lib/labels";
import {
  conferenciaPrestacao,
  type ConferenciaLinha,
  type ConferenciaNotaFatia,
} from "@/services/conferencia";
import { getAircraft, monthsLabel, partnerShort } from "@/services/operacao";

function formatLitros(value: number): string {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value)} L`;
}

function centavos(value: number): number {
  return Math.round(value * 100) / 100;
}

function CelulaNotas({ notas, vazia = "—" }: { notas: ConferenciaNotaFatia[]; vazia?: string }) {
  if (notas.length === 0) {
    return <span className="text-tse-muted">{vazia}</span>;
  }
  return (
    <ul className="space-y-1">
      {notas.map((nota) => (
        <li key={nota.notaId} className="leading-tight">
          {nota.anexoUrl ? (
            <a
              href={nota.anexoUrl}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-tse-olive hover:underline"
            >
              {nota.numero}
            </a>
          ) : (
            <span className="font-semibold tabular-nums">{nota.numero}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ConferenciaView() {
  useDados();
  const { aircraftId, months, partnerId } = useOperacao();
  const [filtroSocio, setFiltroSocio] = useState<string | null>(null);

  useEffect(() => {
    setFiltroSocio(null);
  }, [aircraftId, months, partnerId]);

  const dados = useMemo(
    () => conferenciaPrestacao(months, aircraftId, partnerId),
    [months, aircraftId, partnerId],
  );

  const linhas = useMemo(() => {
    if (!filtroSocio) return dados.linhas;
    const resultado: ConferenciaLinha[] = [];
    for (const linha of dados.linhas) {
      if (!linha.rateioParticipacao) {
        if (linha.partnerId === filtroSocio) resultado.push(linha);
        continue;
      }
      const share =
        getAircraft(linha.aircraftId)?.ownership.find((item) => item.partnerId === filtroSocio)
          ?.share ?? 0;
      if (!(share > 0)) continue;
      resultado.push({
        ...linha,
        key: `${linha.key}:${filtroSocio}`,
        partnerId: filtroSocio,
        litros: linha.litros * share,
        combCalculo: centavos(linha.combCalculo * share),
        taxasCalculo: centavos(linha.taxasCalculo * share),
      });
    }
    return resultado;
  }, [dados.linhas, filtroSocio]);

  const totalCombTabela = useMemo(
    () =>
      centavos(
        linhas.reduce((soma, linha) => soma + (linha.combNaNf ? linha.combCalculo : 0), 0),
      ),
    [linhas],
  );
  const totalTaxasTabela = useMemo(
    () => centavos(linhas.reduce((soma, linha) => soma + linha.taxasCalculo, 0)),
    [linhas],
  );

  const contextoPeriodo = [
    aircraftId === "todas"
      ? "Toda a operação"
      : (getAircraft(aircraftId)?.registration ?? aircraftId),
    monthsLabel(months),
  ].join(" · ");

  const vibra = dados.combustivel;
  const taxas = dados.taxas;
  const totalDespesas = dados.totalNotas;
  const totalDistribuido = dados.totalDistribuido;
  const saldo = Math.max(0, centavos(totalDespesas - totalDistribuido));
  const fechado = saldo <= 0.02 && totalDespesas > 0;
  const socioFiltro = filtroSocio ? partnerShort(filtroSocio) : null;

  return (
    <PageStack>
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight">Prestação de contas</h1>
        <p className="mt-0.5 text-[13px] text-tse-muted">
          Uma linha por trecho · combustível Vibra + taxas aeroportuárias · {contextoPeriodo}
        </p>
      </div>

      <FiltrosOperacao
        compacto={Boolean(partnerId)}
        legenda="Despesas = NFs Vibra + tarifas de pouso, rateadas trecho a trecho (FIFO)."
      />

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">
          Despesas · notas × trechos
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[#F7F8F9] px-3 py-3">
            <p className="text-[11px] text-tse-muted">Combustível · Vibra</p>
            <p className="mt-1 text-[22px] leading-none font-bold tracking-tight tabular-nums">
              {formatBRL(vibra.valor)}
            </p>
            <p className="mt-1 text-[12px] text-tse-muted">
              {vibra.quantidade} NF(s)
              {vibra.distribuido > 0 ? ` · nos trechos ${formatBRL(vibra.distribuido)}` : ""}
            </p>
          </div>
          <div className="rounded-xl bg-[#F7F8F9] px-3 py-3">
            <p className="text-[11px] text-tse-muted">Taxas aeroportuárias</p>
            <p className="mt-1 text-[22px] leading-none font-bold tracking-tight tabular-nums">
              {formatBRL(taxas.valor > 0 ? taxas.valor : taxas.distribuido)}
            </p>
            <p className="mt-1 text-[12px] text-tse-muted">
              {taxas.quantidade > 0 ? `${taxas.quantidade} NF(s)` : "nos trechos"}
              {taxas.distribuido > 0 ? ` · ${formatBRL(taxas.distribuido)}` : ""}
            </p>
          </div>
          <div className="rounded-xl bg-[#F7F8F9] px-3 py-3">
            <p className="text-[11px] text-tse-muted">Total despesas</p>
            <p className="mt-1 text-[22px] leading-none font-bold tracking-tight tabular-nums">
              {formatBRL(totalDespesas > 0 ? totalDespesas : vibra.valor + taxas.distribuido)}
            </p>
            <p className="mt-1 text-[12px] text-tse-muted">
              distribuído {formatBRL(totalDistribuido)}
              {" · "}
              {fechado ? (
                <span className="font-semibold text-pos-faturado">conferência fechada</span>
              ) : saldo > 0.009 ? (
                <span className="font-semibold text-pos-provisionado">saldo {formatBRL(saldo)}</span>
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>

        <p className="mt-3 text-[12px] text-tse-muted">
          {linhas.length} trecho(s)
          {socioFiltro ? ` · filtro ${socioFiltro}` : " no período"}
          {vibra.litrosDistribuidos > 0 && !filtroSocio
            ? ` · ${formatLitros(vibra.litrosDistribuidos)} de combustível rateados`
            : ""}
        </p>

        {dados.porSolicitante.length > 0 ? (
          <ul className="mt-4 grid gap-3 border-t border-[#EEEEEE] pt-4 sm:grid-cols-3">
            {dados.porSolicitante.map((item) => {
              const totalSocio = centavos(item.combustivel + item.taxas);
              const ativo = filtroSocio === item.partnerId;
              const cor = corDoSocio(item.partnerId);
              return (
                <li key={item.partnerId}>
                  <button
                    type="button"
                    aria-pressed={ativo}
                    onClick={() =>
                      setFiltroSocio((atual) =>
                        atual === item.partnerId ? null : item.partnerId,
                      )
                    }
                    className={`w-full rounded-xl border px-3 py-3 text-left text-[13px] transition ${
                      ativo
                        ? "border-transparent bg-white shadow-[inset_0_0_0_2px_var(--cor-socio)]"
                        : "border-[#EEF0F3] bg-white hover:border-[#D7DCE3]"
                    }`}
                    style={
                      ativo
                        ? ({ ["--cor-socio"]: cor } as CSSProperties)
                        : undefined
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: cor }}
                        aria-hidden
                      />
                      <p className="font-semibold">{partnerShort(item.partnerId)}</p>
                      <p className="ml-auto text-[11px] text-tse-muted">
                        {item.trechos} trecho(s)
                        {ativo ? " · filtrando" : ""}
                      </p>
                    </div>
                    <dl className="mt-2 space-y-1 tabular-nums">
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-tse-muted">Combustível</dt>
                        <dd>{formatBRL(item.combustivel)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-tse-muted">Taxas</dt>
                        <dd>{formatBRL(item.taxas)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 border-t border-[#EEEEEE] pt-1">
                        <dt className="font-semibold">Total</dt>
                        <dd className="font-bold">{formatBRL(totalSocio)}</dd>
                      </div>
                    </dl>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {linhas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-tse-border bg-white px-4 py-8 text-center text-[13px] text-tse-muted">
          {filtroSocio
            ? `Nenhum trecho de ${partnerShort(filtroSocio)} neste recorte.`
            : "Nenhum trecho neste recorte."}
        </p>
      ) : (
        <TableWrap>
          <table className={`${tableClass} min-w-[1100px]`}>
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Data</th>
                <th className={thClass}>Trecho</th>
                <th className={`${thClass} text-right`}>Tempo</th>
                <th className={`${thClass} text-right`}>Litros</th>
                <th className={thClass}>Sócio</th>
                <th className={`${thClass} text-right`}>Combustível</th>
                <th className={thClass}>NF Vibra</th>
                <th className={`${thClass} text-right`}>Taxas</th>
                <th className={thClass}>NF taxas</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={linha.key} className={trClass}>
                  <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                    {formatDateLista(linha.date)}
                  </td>
                  <td className={`${tdClass} min-w-[200px]`}>
                    <Link
                      href={`/itinerarios/${linha.itineraryId}`}
                      className="font-semibold text-tse-text hover:underline"
                    >
                      {linha.route}
                    </Link>
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {linha.blockHours > 0 ? formatHours(linha.blockHours) : "—"}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums text-tse-muted`}>
                    {linha.litros > 0 ? formatLitros(linha.litros) : "—"}
                  </td>
                  <td className={tdClass}>
                    {linha.rateioParticipacao && !filtroSocio ? (
                      <span className="font-semibold">
                        Participação
                        <span className="mt-0.5 block text-[11px] font-normal text-tse-muted">
                          traslado · todos os sócios
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <span
                          className="size-1.5 rounded-full"
                          style={{ background: corDoSocio(linha.partnerId) }}
                          aria-hidden
                        />
                        {partnerShort(linha.partnerId)}
                        {linha.rateioParticipacao ? (
                          <span className="text-[11px] font-normal text-tse-muted">· cota</span>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums font-semibold`}>
                    {linha.combCalculo > 0 ? formatBRL(linha.combCalculo) : "—"}
                  </td>
                  <td className={tdClass}>
                    <CelulaNotas notas={linha.combNotas} />
                  </td>
                  <td className={`${tdClass} text-right tabular-nums font-semibold`}>
                    {linha.taxasCalculo > 0 ? formatBRL(linha.taxasCalculo) : "—"}
                  </td>
                  <td className={tdClass}>
                    <CelulaNotas notas={linha.taxasNotas} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-tse-border bg-tse-bg">
                <td className={`${tdClass} font-bold`} colSpan={5}>
                  Total · {linhas.length} trecho(s)
                  {socioFiltro ? ` · ${socioFiltro}` : ""}
                </td>
                <td className={`${tdClass} text-right font-bold tabular-nums`}>
                  {formatBRL(totalCombTabela)}
                </td>
                <td className={tdClass} />
                <td className={`${tdClass} text-right font-bold tabular-nums`}>
                  {totalTaxasTabela > 0 ? formatBRL(totalTaxasTabela) : "—"}
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
