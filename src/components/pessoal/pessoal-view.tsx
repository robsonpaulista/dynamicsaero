"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Search, Users } from "lucide-react";
import { BotaoNovo, LinkEditar } from "@/components/formularios/campos";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import { PageStack } from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { formatPercent } from "@/lib/format";
import { mascaraWhatsapp, digitosWhatsapp } from "@/lib/telefone";
import { corDoSocio } from "@/lib/labels";
import {
  getAircraft,
  listAircraft,
  listPartners,
  monthsLabel,
} from "@/services/operacao";

export function PessoalView() {
  useDados();
  const { aircraftId, months, partnerId } = useOperacao();
  const [query, setQuery] = useState<string>("");

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
            <h1 className="text-[22px] font-bold tracking-tight">Sócios</h1>
            <p className="mt-0.5 text-[13px] text-tse-muted">{contextoPeriodo}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight">Sócios</h1>
            <p className="mt-0.5 text-[13px] text-tse-muted">{contextoPeriodo}</p>
          </div>
          <Link
            href="/pessoal/novo"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-tse-text text-white shadow-sm md:hidden"
            aria-label="Novo sócio"
          >
            <Plus className="size-5" aria-hidden />
          </Link>
        </div>
      )}

      <FiltrosOperacao
        compacto={Boolean(partnerId)}
        legenda={
          partnerId
            ? undefined
            : "Cadastro dos cotistas. Tripulação e folha entram em Despesas (fixas)."
        }
      />

      {!partnerId ? (
        <div className="hidden justify-end md:flex">
          <BotaoNovo href="/pessoal/novo">Novo sócio</BotaoNovo>
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">Resumo</p>
        <div className="mt-3 flex items-center gap-2">
          <Users className="size-4 shrink-0 text-tse-olive" aria-hidden />
          <p className="text-[18px] font-bold tracking-tight tabular-nums sm:text-[20px]">
            {cotistas.length}{" "}
            <span className="text-[13px] font-semibold text-tse-muted">
              {cotistas.length === 1 ? "sócio" : "sócios"}
            </span>
          </p>
        </div>
        <p className="mt-2 text-[12px] text-tse-muted">
          Tripulação, gestão e demais custos de pessoal vão em{" "}
          <Link href="/despesas?recorte=fixas" className="font-bold text-[#6B5B95]">
            Despesas fixas
          </Link>
          .
        </p>
      </section>

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm">
        <label className="relative block">
          <span className="sr-only">Buscar sócios</span>
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
                        color: "#ffffff",
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
                          Sócio
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
    </PageStack>
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
