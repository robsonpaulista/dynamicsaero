"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, CircleDollarSign, Plus, Search, Users } from "lucide-react";
import { BotaoNovo, LinkEditar } from "@/components/formularios/campos";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import { PageStack, StatusBadge } from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { daysUntil, formatBRL, formatDate, formatPercent } from "@/lib/format";
import { mascaraWhatsapp, digitosWhatsapp } from "@/lib/telefone";
import { corDoSocio, ROLE_LABEL } from "@/lib/labels";
import {
  getAircraft,
  HOJE,
  listAircraft,
  listCrew,
  listPartners,
  matchesAircraft,
  monthsLabel,
} from "@/services/operacao";

export function PessoalView() {
  useDados();
  const { aircraftId, months, partnerId } = useOperacao();
  const [query, setQuery] = useState<string>("");

  const people = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return listCrew()
      .filter((person) => person.aircraftIds.some((id) => matchesAircraft(id, aircraftId)))
      .filter((person) => {
        if (!needle) return true;
        const blob = [person.name, ROLE_LABEL[person.role], person.base, person.nextDuty]
          .join(" ")
          .toLowerCase();
        return blob.includes(needle);
      });
  }, [aircraftId, query]);

  const cotistas = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return listPartners()
      .filter((partner) => {
        if (partnerId) return partner.id === partnerId;
        if (aircraftId === "todas") return true;
        const craft = getAircraft(aircraftId);
        return (
          craft?.ownership.some((item) => item.partnerId === partner.id && item.share > 0) ?? false
        );
      })
      .filter((partner) => {
        if (!needle) return true;
        const blob = [partner.name, partner.role, partner.company, partner.phone]
          .join(" ")
          .toLowerCase();
        return blob.includes(needle);
      });
  }, [aircraftId, partnerId, query]);

  const folha = people.reduce((sum, person) => sum + person.monthlyCost, 0);
  const contextoPeriodo = [
    aircraftId === "todas"
      ? "Toda a operação"
      : (getAircraft(aircraftId)?.registration ?? aircraftId),
    monthsLabel(months),
  ].join(" · ");

  return (
    <PageStack>
      {partnerId ? (
        <div className="flex items-start gap-3">
          <Link
            href="/painel"
            className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-tse-text shadow-sm"
            aria-label="Voltar ao painel"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight">Pessoal</h1>
            <p className="mt-0.5 text-[13px] text-tse-muted">{contextoPeriodo}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight">Pessoal</h1>
            <p className="mt-0.5 text-[13px] text-tse-muted">{contextoPeriodo}</p>
          </div>
          <Link
            href="/pessoal/novo"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-tse-text text-white shadow-sm md:hidden"
            aria-label="Nova pessoa"
          >
            <Plus className="size-5" aria-hidden />
          </Link>
        </div>
      )}

      <FiltrosOperacao
        compacto={Boolean(partnerId)}
        legenda={partnerId ? undefined : "Cotistas, tripulação e gestão da operação."}
      />

      {!partnerId ? (
        <div className="hidden justify-end md:flex">
          <BotaoNovo href="/pessoal/novo">Nova pessoa</BotaoNovo>
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">Resumo</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MetricaIcone icone={Users} label="Cotistas" value={String(cotistas.length)} />
          <MetricaIcone icone={Users} label="Tripulação" value={String(people.length)} />
          <MetricaIcone
            icone={CircleDollarSign}
            label="Folha"
            value={formatBRL(Math.round(folha))}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm">
        <label className="relative block">
          <span className="sr-only">Buscar pessoal</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tse-muted"
            aria-hidden
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, papel ou empresa"
            className="h-11 w-full rounded-xl border border-tse-line bg-tse-bg/40 pr-3 pl-10 text-[14px] outline-none focus:border-tse-olive"
          />
        </label>
      </section>

      <section>
        <h2 className="text-[16px] font-bold">Cotistas</h2>
        <p className="mt-1 text-[13px] text-tse-muted">
          Quem participa das aeronaves. O percentual fica no cadastro da frota.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cotistas.length === 0 ? (
            <p className="rounded-2xl border border-[#EEF0F3] bg-white px-4 py-6 text-[13px] text-tse-muted shadow-sm">
              Nenhum cotista neste recorte.
            </p>
          ) : (
            cotistas.map((partner) => {
              const fatias = participacao(partner.id);
              return (
                <article
                  key={partner.id}
                  className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                      style={{
                        background: corDoSocio(partner.id),
                        color: corDoSocio(partner.id) === "#EBB402" ? "#333333" : "#ffffff",
                      }}
                    >
                      {iniciais(partner.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-[16px] font-bold">{partner.name}</h3>
                          <p className="text-[13px] text-tse-muted">
                            {partner.role} · {partner.company}
                          </p>
                        </div>
                        <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-bold tracking-wide text-[#334155] uppercase">
                          Cotista
                        </span>
                      </div>
                      <p className="mt-3 text-[13px]">
                        {fatias.length > 0
                          ? fatias.join(" · ")
                          : "Sem participação lançada na frota."}
                      </p>
                      {partner.phone ? (
                        <a
                          href={`https://wa.me/${digitosWhatsapp(partner.phone)}`}
                          className="mt-2 block text-[13px] font-semibold text-tse-olive hover:underline"
                        >
                          {mascaraWhatsapp(partner.phone)}
                        </a>
                      ) : null}
                      {!partnerId ? (
                        <div className="mt-3 border-t border-[#EEEEEE] pt-3">
                          <LinkEditar href={`/pessoal/${partner.id}/editar`} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {!partnerId ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-[16px] font-bold">Tripulação e gestão</h2>
          <article className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
            <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">
              Folha do período
            </p>
            <p className="mt-2 text-[32px] font-bold tracking-tight tabular-nums">
              {formatBRL(folha)}
            </p>
            <p className="mt-1 text-[13px] text-tse-muted">
              Quem atende mais de uma aeronave tem o custo repartido entre elas e, depois, entre os
              sócios.
            </p>
          </article>
          <div className="grid gap-3 md:grid-cols-2">
            {people.map((person) => {
              const documents = [
                { label: person.documentLabel, date: person.documentExpiry },
                person.medicalExpiry && person.medicalLabel
                  ? { label: person.medicalLabel, date: person.medicalExpiry }
                  : null,
              ].filter((item): item is { label: string; date: string } => item !== null);

              return (
                <article
                  key={person.id}
                  className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tse-soft text-[13px] font-bold text-tse-gold">
                      {iniciais(person.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 className="text-[16px] font-bold">{person.name}</h2>
                          <p className="text-[13px] text-tse-muted">
                            {ROLE_LABEL[person.role]} · {person.base}
                          </p>
                        </div>
                        <StatusBadge value={person.status} />
                      </div>
                      <p className="mt-3 text-[13px]">{person.nextDuty}</p>
                      <p className="mt-1 text-[13px] font-bold tabular-nums">
                        {formatBRL(person.monthlyCost)} / mês
                      </p>
                      <p className="mt-2 text-[12px] text-tse-muted">
                        {person.aircraftIds
                          .map((id) => getAircraft(id)?.registration)
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <ul className="mt-3 space-y-2">
                        {documents.map((document) => {
                          const days = daysUntil(document.date, HOJE);
                          const tone =
                            days < 0
                              ? "text-[#EF4444]"
                              : days <= 35
                                ? "text-[#0369A1]"
                                : "text-tse-olive";
                          return (
                            <li
                              key={document.label}
                              className="flex items-center justify-between gap-3 text-[13px]"
                            >
                              <span>{document.label}</span>
                              <span className={`text-right font-semibold ${tone}`}>
                                {formatDate(document.date)}
                                <span className="block text-[11px] font-bold tracking-wide uppercase">
                                  {days < 0
                                    ? "Vencido"
                                    : days === 0
                                      ? "Vence hoje"
                                      : `${days} dias`}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="mt-3 border-t border-[#EEEEEE] pt-3">
                        <LinkEditar href={`/pessoal/${person.id}/editar`} />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </PageStack>
  );
}

function MetricaIcone({
  icone: Icone,
  label,
  value,
}: {
  icone: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[11px] text-tse-muted">
        <Icone className="size-3.5 shrink-0 text-tse-olive" aria-hidden />
        {label}
      </p>
      <p className="mt-1 truncate text-[18px] font-bold tracking-tight tabular-nums sm:text-[20px]">
        {value}
      </p>
    </div>
  );
}

function participacao(partnerId: string): string[] {
  return listAircraft().flatMap((craft) => {
    const share = craft.ownership.find((item) => item.partnerId === partnerId)?.share ?? 0;
    if (share <= 0) return [];
    return [`${craft.registration} ${formatPercent(share)}`];
  });
}

function iniciais(name: string): string {
  const parts = name.split(" ").filter((part) => part.length > 2);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}
