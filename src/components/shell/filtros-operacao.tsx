"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plane } from "lucide-react";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { cn } from "@/lib/format";
import {
  listAircraft,
  listMonths,
  listPartners,
  monthsAtivos,
  monthsLabel,
} from "@/services/operacao";

const MES_CURTO = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

function rotuloMesCompacto(months: ReturnType<typeof monthsAtivos>, fallback: string): string {
  if (!months) return "Todos";
  if (months.length === 1) {
    const id = months[0] ?? "";
    const [ano, mes] = id.split("-");
    const indice = Number(mes) - 1;
    if (ano && indice >= 0 && indice < 12) {
      return `${MES_CURTO[indice]}/${ano}`;
    }
  }
  if (months.length === 2) {
    return months
      .map((id) => {
        const mes = Number(id.slice(5, 7)) - 1;
        return MES_CURTO[mes] ?? id;
      })
      .join("–");
  }
  return fallback;
}

export function FiltrosOperacao({
  legenda,
  compacto = false,
  socioId,
  onSocioChange,
}: {
  legenda?: string;
  /** Seletores na mesma linha, sem legenda — ideal para mobile financeiro. */
  compacto?: boolean;
  /** Filtro opcional por sócio (Despesas). */
  socioId?: string;
  onSocioChange?: (socioId: string) => void;
}) {
  useDados();
  const { aircraftId, setAircraftId, months, setMonths } = useOperacao();
  const aircraft = listAircraft();
  const socios = listPartners();
  const opcoes = listMonths();
  const [aberto, setAberto] = useState<boolean>(false);
  const caixa = useRef<HTMLDivElement>(null);
  const comSocio = typeof socioId === "string" && typeof onSocioChange === "function";

  useEffect(() => {
    if (!aberto) return;
    function fechar(event: MouseEvent) {
      if (!caixa.current?.contains(event.target as Node)) setAberto(false);
    }
    function tecla(event: KeyboardEvent) {
      if (event.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fechar);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const todos = monthsAtivos(months) === null;
  const rotuloCompleto = monthsLabel(months);
  const rotulo = compacto
    ? rotuloMesCompacto(monthsAtivos(months), rotuloCompleto)
    : rotuloCompleto;
  const craft = aircraft.find((item) => item.id === aircraftId);

  function escolherTodos() {
    setMonths(["todos"]);
  }

  function alternarMes(id: string) {
    const ativos = monthsAtivos(months);
    if (!ativos) {
      setMonths([id]);
      return;
    }
    if (ativos.includes(id)) {
      const resto = ativos.filter((item) => item !== id);
      setMonths(resto.length > 0 ? resto : ["todos"]);
      return;
    }
    setMonths([...ativos, id].sort());
  }

  const seletorSocio = comSocio ? (
    <label className={cn("relative", compacto ? "min-w-0 flex-1" : "min-w-0")}>
      <span className="sr-only">Sócio</span>
      {!compacto ? (
        <span className="mb-0.5 hidden text-[13px] font-semibold text-tse-text sm:block">Sócio</span>
      ) : null}
      <span className="relative block">
        <select
          value={socioId}
          onChange={(event) => onSocioChange?.(event.target.value)}
          className={cn(
            "cursor-pointer appearance-none truncate outline-none",
            compacto
              ? "h-10 w-full rounded-xl border border-tse-line bg-white px-3 pr-8 text-[14px] font-semibold"
              : "max-w-[min(100%,12rem)] bg-transparent pr-7 text-[15px] font-semibold text-tse-text sm:max-w-none sm:text-[16px]",
          )}
        >
          <option value="todos">Todos os sócios</option>
          {socios.map((item) => (
            <option key={item.id} value={item.id}>
              {item.shortName}
            </option>
          ))}
          <option value="sem">Sem identificação</option>
        </select>
        <ChevronDown
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-tse-muted",
            compacto ? "right-2.5 size-4" : "right-0 size-4 text-tse-yellow",
          )}
        />
      </span>
    </label>
  ) : null;

  if (compacto) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-[calc(50%-0.25rem)]">
          <span className="sr-only">Aeronave</span>
          <select
            value={aircraftId}
            onChange={(event) => setAircraftId(event.target.value)}
            className="h-10 w-full cursor-pointer appearance-none truncate rounded-xl border border-tse-line bg-white px-3 pr-8 text-[14px] font-semibold outline-none"
          >
            <option value="todas">Toda a operação</option>
            {aircraft.map((item) => (
              <option key={item.id} value={item.id}>
                {item.registration}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-tse-muted" />
        </label>
        <div ref={caixa} className="relative min-w-0 flex-1 basis-[calc(50%-0.25rem)]">
          <button
            type="button"
            aria-expanded={aberto}
            aria-haspopup="listbox"
            aria-label={`Período: ${rotulo}`}
            onClick={() => setAberto((atual) => !atual)}
            className="flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border-2 border-tse-yellow bg-tse-yellow-strong/30 px-3 text-[14px] font-bold outline-none"
          >
            <span className="truncate">{rotulo}</span>
            <ChevronDown className="size-4 shrink-0 text-tse-text" aria-hidden />
          </button>
          {aberto ? (
            <div
              role="listbox"
              aria-multiselectable
              className="absolute top-full right-0 left-0 z-30 mt-2 rounded-xl border border-tse-line bg-white p-2 shadow-lg"
            >
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-semibold hover:bg-tse-soft">
                <input
                  type="checkbox"
                  checked={todos}
                  onChange={escolherTodos}
                  className="size-3.5 accent-tse-olive"
                />
                Todos os meses
              </label>
              <div className="my-1 border-t border-tse-line" />
              <div className="max-h-64 overflow-y-auto">
                {opcoes.map((item) => {
                  const marcado = !todos && (monthsAtivos(months)?.includes(item.id) ?? false);
                  return (
                    <label
                      key={item.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium hover:bg-tse-soft",
                        marcado ? "text-tse-text" : "text-tse-muted",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternarMes(item.id)}
                        className="size-3.5 accent-tse-olive"
                      />
                      {item.label}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
        {seletorSocio}
        {craft && aircraftId !== "todas" ? (
          <span className="sr-only">{craft.model}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-row flex-wrap items-center gap-3 sm:gap-8">
        <label className="flex min-w-0 items-center gap-2">
          <Plane className="size-5 shrink-0 fill-tse-yellow text-tse-yellow" aria-hidden />
          <span className="sr-only">Aeronave</span>
          <span className="relative min-w-0">
            <select
              value={aircraftId}
              onChange={(event) => setAircraftId(event.target.value)}
              className="max-w-[min(100%,14rem)] cursor-pointer appearance-none truncate bg-transparent pr-7 text-[15px] font-semibold text-tse-text outline-none sm:max-w-none sm:text-[16px]"
            >
              <option value="todas">Toda a operação</option>
              {aircraft.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.registration} · {item.model}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-0 size-4 -translate-y-1/2 text-tse-yellow" />
          </span>
        </label>

        <div ref={caixa} className="relative text-[13px] font-semibold text-tse-text">
          <span className="block text-[11px] font-bold tracking-wide text-tse-muted uppercase">
            Período
          </span>
          <button
            type="button"
            aria-expanded={aberto}
            aria-haspopup="listbox"
            onClick={() => setAberto((atual) => !atual)}
            className="mt-0.5 inline-flex max-w-full cursor-pointer items-center gap-2 rounded-md bg-tse-yellow-strong px-2.5 py-1 text-[15px] font-bold text-tse-text outline-none ring-2 ring-tse-yellow-strong/40"
          >
            <span className="truncate sm:hidden">{rotuloMesCompacto(monthsAtivos(months), rotuloCompleto)}</span>
            <span className="hidden truncate sm:inline">{rotuloCompleto}</span>
            <ChevronDown className="size-4 shrink-0" aria-hidden />
          </button>
          {aberto ? (
            <div
              role="listbox"
              aria-multiselectable
              className="absolute top-full left-0 z-30 mt-2 min-w-[220px] rounded-xl border border-tse-line bg-white p-2 shadow-lg"
            >
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-semibold hover:bg-tse-soft">
                <input
                  type="checkbox"
                  checked={todos}
                  onChange={escolherTodos}
                  className="size-3.5 accent-tse-olive"
                />
                Todos os meses
              </label>
              <div className="my-1 border-t border-tse-line" />
              <div className="max-h-64 overflow-y-auto">
                {opcoes.map((item) => {
                  const marcado = !todos && (monthsAtivos(months)?.includes(item.id) ?? false);
                  return (
                    <label
                      key={item.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium hover:bg-tse-soft",
                        marcado ? "text-tse-text" : "text-tse-muted",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternarMes(item.id)}
                        className="size-3.5 accent-tse-olive"
                      />
                      {item.label}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
        {seletorSocio}
      </div>
      {legenda ? <p className="hidden text-[12px] text-tse-muted lg:block">{legenda}</p> : null}
    </div>
  );
}
