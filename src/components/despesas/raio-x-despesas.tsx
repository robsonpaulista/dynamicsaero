"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ScanSearch } from "lucide-react";
import { cn, formatBRL, formatDateShort, formatPercent } from "@/lib/format";
import { CATEGORY_LABEL, corDoSocio } from "@/lib/labels";
import {
  getAircraft,
  partnerName,
  partnerShort,
  raioXAlocacao,
  type RaioXAlocacao,
} from "@/services/operacao";
import type { Expense } from "@/types/operacao";

const LEGENDA = [
  {
    id: "solicitante",
    titulo: "Quem pediu o voo",
    texto: "Custo integral no sócio solicitante. Cruza com itinerário/etapa (ou tarifa de pouso casada).",
  },
  {
    id: "participacao",
    titulo: "Pela participação",
    texto: "Divide pela % de cada sócio na aeronave (hangar, seguro, estrutura e tarifas sem voo).",
  },
  {
    id: "tarifa",
    titulo: "Tarifa de pouso",
    texto: "Tenta casar ICAO + data com uma etapa. Se casar → solicitante; se não → participação.",
  },
] as const;

function badgeCriterio(raio: RaioXAlocacao): { label: string; className: string } {
  if (raio.criterio === "solicitante") {
    return { label: raio.regra, className: "bg-[#DBEAFE] text-[#1D4ED8]" };
  }
  if (raio.criterio === "participacao") {
    return { label: raio.regra, className: "bg-[#FEF3C7] text-[#B45309]" };
  }
  return { label: raio.regra, className: "bg-[#FEE2E2] text-[#B91C1C]" };
}

function tituloCurto(expense: Expense): string {
  const parte = expense.description.split(" · ")[0]?.trim();
  return parte && parte.length > 0 ? parte : CATEGORY_LABEL[expense.category];
}

export function RaioXDespesas({
  despesas,
  socioId,
}: {
  despesas: Expense[];
  socioId?: string | null;
}) {
  const [aberto, setAberto] = useState<boolean>(true);
  const [expansoes, setExpansoes] = useState<string[]>([]);

  const linhas = useMemo(() => {
    return despesas
      .map((expense) => {
        const raio = raioXAlocacao(expense);
        const partes = socioId
          ? raio.partes.filter((item) => item.partnerId === socioId && item.amount > 0)
          : raio.partes.filter((item) => item.amount > 0);
        return { expense, raio, partes };
      })
      .filter((item) => (socioId ? item.partes.length > 0 : true));
  }, [despesas, socioId]);

  const totaisPorSocio = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const linha of linhas) {
      for (const parte of linha.raio.partes) {
        if (socioId && parte.partnerId !== socioId) continue;
        if (parte.amount <= 0) continue;
        mapa.set(parte.partnerId, (mapa.get(parte.partnerId) ?? 0) + parte.amount);
      }
    }
    return [...mapa.entries()]
      .map(([partnerId, amount]) => ({ partnerId, amount }))
      .sort((left, right) => right.amount - left.amount);
  }, [linhas, socioId]);

  function alternar(id: string) {
    setExpansoes((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id],
    );
  }

  function expandirTodos() {
    setExpansoes(linhas.map((item) => item.expense.id));
  }

  function recolherTodos() {
    setExpansoes([]);
  }

  return (
    <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((atual) => !atual)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <ScanSearch className="size-4 shrink-0 text-tse-olive" aria-hidden />
            <span className="text-[16px] font-bold">Raio-X da alocação</span>
          </span>
          <span className="mt-1 block text-[13px] text-tse-muted">
            Como cada despesa foi cruzada e quanto coube a cada sócio.
          </span>
        </span>
        <ChevronDown
          className={cn(
            "mt-1 size-4 shrink-0 text-tse-muted transition-transform",
            aberto && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {aberto ? (
        <div className="mt-4 space-y-4">
          <ul className="grid gap-2 sm:grid-cols-3">
            {LEGENDA.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-[#EEF0F3] bg-tse-bg/50 px-3 py-2.5"
              >
                <p className="text-[12px] font-bold">{item.titulo}</p>
                <p className="mt-1 text-[12px] leading-4 text-tse-muted">{item.texto}</p>
              </li>
            ))}
          </ul>

          {totaisPorSocio.length > 0 ? (
            <div className="rounded-xl border border-[#EEF0F3] px-3 py-3">
              <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">
                Cruzamento consolidado
              </p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {totaisPorSocio.map((item) => (
                  <li key={item.partnerId} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="flex min-w-0 items-center gap-2 font-semibold">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: corDoSocio(item.partnerId) }}
                      />
                      <span className="truncate">{partnerShort(item.partnerId)}</span>
                    </span>
                    <span className="shrink-0 font-bold tabular-nums">{formatBRL(item.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-tse-muted">
              {linhas.length} lançamento{linhas.length === 1 ? "" : "s"} no raio-x
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={expandirTodos}
                className="rounded-full border border-[#EEF0F3] bg-white px-3 py-1 text-[12px] font-bold text-tse-olive"
              >
                Expandir
              </button>
              <button
                type="button"
                onClick={recolherTodos}
                className="rounded-full border border-[#EEF0F3] bg-white px-3 py-1 text-[12px] font-bold text-tse-muted"
              >
                Recolher
              </button>
            </div>
          </div>

          {linhas.length === 0 ? (
            <p className="rounded-xl border border-[#EEF0F3] px-4 py-6 text-center text-[13px] text-tse-muted">
              Nenhuma despesa para cruzar neste recorte.
            </p>
          ) : (
            <ul className="divide-y divide-[#EEEEEE] overflow-hidden rounded-xl border border-[#EEF0F3]">
              {linhas.map(({ expense, raio, partes }) => {
                const craft = getAircraft(expense.aircraftId);
                const abertoLinha = expansoes.includes(expense.id);
                const badge = badgeCriterio(raio);
                const minhaParte = socioId
                  ? partes.reduce((soma, item) => soma + item.amount, 0)
                  : null;
                return (
                  <li key={expense.id}>
                    <button
                      type="button"
                      aria-expanded={abertoLinha}
                      onClick={() => alternar(expense.id)}
                      className="flex w-full items-start gap-3 px-3 py-3 text-left sm:px-4"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-bold">{tituloCurto(expense)}</span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[12px] text-tse-muted">
                          {formatDateShort(expense.date)}
                          {craft ? ` · ${craft.registration}` : ""}
                          {` · ${CATEGORY_LABEL[expense.category]}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[14px] font-bold tabular-nums">
                          {formatBRL(minhaParte ?? expense.amount)}
                        </span>
                        {minhaParte !== null && minhaParte !== expense.amount ? (
                          <span className="text-[11px] text-tse-muted">
                            de {formatBRL(expense.amount)}
                          </span>
                        ) : null}
                      </span>
                      <ChevronDown
                        className={cn(
                          "mt-1 size-4 shrink-0 text-tse-muted transition-transform",
                          abertoLinha && "rotate-180",
                        )}
                        aria-hidden
                      />
                    </button>
                    {abertoLinha ? (
                      <div className="space-y-3 border-t border-[#EEEEEE] bg-tse-bg/40 px-3 py-3 sm:px-4">
                        <div>
                          <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">
                            Cruzamento feito
                          </p>
                          <p className="mt-1 text-[13px] leading-5 text-tse-text">{raio.cruzamento}</p>
                        </div>
                        {raio.partes.length === 0 ? (
                          <p className="text-[13px] font-semibold text-[#B91C1C]">
                            Ainda sem sócio responsável neste lançamento.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {raio.partes.map((parte) => (
                              <li
                                key={parte.partnerId}
                                className={cn(
                                  "flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-[13px]",
                                  socioId && parte.partnerId === socioId && "ring-1 ring-tse-olive/30",
                                )}
                              >
                                <span className="flex min-w-0 items-center gap-2 font-semibold">
                                  <span
                                    className="size-2.5 shrink-0 rounded-full"
                                    style={{ background: corDoSocio(parte.partnerId) }}
                                  />
                                  <span className="truncate">{partnerName(parte.partnerId)}</span>
                                  {parte.share !== null ? (
                                    <span className="text-[11px] font-bold text-tse-muted">
                                      {formatPercent(parte.share)}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="shrink-0 font-bold tabular-nums">
                                  {formatBRL(parte.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
