"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  MapPinned,
  Plane,
  Plus,
  Route,
  Search,
} from "lucide-react";
import { BotaoNovo, LinkEditar } from "@/components/formularios/campos";
import { PageStack } from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { cn, formatHours } from "@/lib/format";
import type { Rota } from "@/types/operacao";

export function RotasView() {
  const base = useDados();
  const { partnerId } = useOperacao();
  const [query, setQuery] = useState<string>("");

  const rotas = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...base.rotas]
      .filter((rota) => {
        if (!needle) return true;
        const blob = [
          rota.nome,
          rota.fromIcao,
          rota.toIcao,
          rota.fromCity,
          rota.toCity,
          rota.note,
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(needle);
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [base.rotas, query]);

  const horasMedia =
    rotas.length > 0
      ? rotas.reduce((soma, item) => soma + item.blockHours, 0) / rotas.length
      : 0;
  const aerodromos = new Set(
    rotas.flatMap((rota) => [rota.fromIcao, rota.toIcao].filter(Boolean)),
  ).size;

  return (
    <PageStack>
      {partnerId ? (
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Link
              href="/painel"
              className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-tse-text shadow-sm"
              aria-label="Voltar ao painel"
            >
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold tracking-tight">Rotas</h1>
              <p className="mt-0.5 text-[13px] text-tse-muted">
                Trechos da operação para montar itinerários
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight">Rotas</h1>
            <p className="mt-0.5 text-[13px] text-tse-muted">
              Origem, destino e horas de bloco dos trechos que se repetem
            </p>
          </div>
          <Link
            href="/rotas/nova"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-tse-text text-white shadow-sm md:hidden"
            aria-label="Nova rota"
          >
            <Plus className="size-5" aria-hidden />
          </Link>
        </div>
      )}

      {!partnerId ? (
        <div className="hidden justify-end md:flex">
          <BotaoNovo href="/rotas/nova">Nova rota</BotaoNovo>
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">
          Resumo
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MetricaIcone icone={Route} label="Rotas" value={String(rotas.length)} />
          <MetricaIcone icone={MapPinned} label="Aeródromos" value={String(aerodromos)} />
          <MetricaIcone
            icone={Clock3}
            label="Média bloco"
            value={horasMedia > 0 ? formatHours(horasMedia) : "—"}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm">
        <label className="relative block">
          <span className="sr-only">Buscar rotas</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tse-muted"
            aria-hidden
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por cidade, ICAO ou nome"
            className="h-11 w-full rounded-xl border border-tse-line bg-tse-bg/40 pr-3 pl-10 text-[14px] outline-none focus:border-tse-olive"
          />
        </label>
      </section>

      {rotas.length === 0 ? (
        <p className="rounded-2xl border border-[#EEF0F3] bg-white px-4 py-8 text-center text-[13px] text-tse-muted shadow-sm">
          {query.trim() ? "Nenhuma rota com essa busca." : "Nenhuma rota cadastrada."}
        </p>
      ) : (
        <>
          <p className="text-[13px] text-tse-muted">
            {rotas.length} rota{rotas.length === 1 ? "" : "s"}
          </p>

          <section className="overflow-hidden rounded-2xl border border-[#EEF0F3] bg-white shadow-sm md:hidden">
            <ul className="divide-y divide-[#EEEEEE]">
              {rotas.map((rota) => (
                <li key={rota.id}>
                  <CartaoRota rota={rota} podeEditar={!partnerId} />
                </li>
              ))}
            </ul>
          </section>

          <section className="hidden overflow-hidden rounded-2xl border border-[#EEF0F3] bg-white shadow-sm md:block">
            <ul className="divide-y divide-[#EEEEEE]">
              {rotas.map((rota) => (
                <li
                  key={rota.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                >
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-tse-olive">
                    <Plane className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">{rota.nome}</span>
                    <span className="block truncate text-[13px] text-tse-muted">
                      {rota.fromCity || rota.fromIcao} → {rota.toCity || rota.toIcao}
                      <span className="text-tse-muted">
                        {" "}
                        · {rota.fromIcao} → {rota.toIcao}
                      </span>
                      {rota.blockHours > 0 ? ` · ${formatHours(rota.blockHours)}` : ""}
                    </span>
                    {rota.note ? (
                      <span className="mt-0.5 block truncate text-[12px] text-tse-muted">
                        {rota.note}
                      </span>
                    ) : null}
                  </span>
                  {!partnerId ? <LinkEditar href={`/rotas/${rota.id}/editar`} /> : null}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </PageStack>
  );
}

function MetricaIcone({
  icone: Icone,
  label,
  value,
}: {
  icone: typeof Route;
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

function CartaoRota({ rota, podeEditar }: { rota: Rota; podeEditar: boolean }) {
  const conteudo = (
    <>
      <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-tse-olive">
        <Plane className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[15px] font-bold">{rota.nome}</span>
          {rota.blockHours > 0 ? (
            <span className="shrink-0 text-[15px] font-bold tabular-nums">
              {formatHours(rota.blockHours)}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[12px] text-tse-muted">
          {rota.fromCity || rota.fromIcao} → {rota.toCity || rota.toIcao}
        </span>
        <span className="block text-[12px] text-tse-muted">
          {rota.fromIcao} → {rota.toIcao}
        </span>
      </span>
      {podeEditar ? (
        <ChevronRight className="mt-1 size-4 shrink-0 text-tse-muted" aria-hidden />
      ) : null}
    </>
  );

  if (podeEditar) {
    return (
      <Link
        href={`/rotas/${rota.id}/editar`}
        className={cn("flex w-full items-start gap-3 px-4 py-3.5 text-left")}
      >
        {conteudo}
      </Link>
    );
  }

  return <div className="flex items-start gap-3 px-4 py-3.5">{conteudo}</div>;
}
