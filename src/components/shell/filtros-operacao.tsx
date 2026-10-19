"use client";

import { ChevronDown, Plane } from "lucide-react";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { listAircraft, listMonths } from "@/services/operacao";

export function FiltrosOperacao({ legenda }: { legenda?: string }) {
  useDados();
  const { aircraftId, setAircraftId, month, setMonth } = useOperacao();
  const aircraft = listAircraft();
  const months = listMonths();

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white px-4 py-3 shadow-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
        <label className="flex w-max max-w-full items-center gap-2">
          <Plane className="size-5 shrink-0 fill-tse-yellow text-tse-yellow" aria-hidden />
          <span className="sr-only">Aeronave</span>
          <span className="relative">
            <select
              value={aircraftId}
              onChange={(event) => setAircraftId(event.target.value)}
              className="w-max max-w-full cursor-pointer appearance-none bg-transparent pr-7 text-[16px] font-semibold text-tse-text outline-none"
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
        <label className="text-[13px] font-semibold text-tse-text">
          Mês
          <span className="relative mt-0.5 block">
            <select
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="cursor-pointer appearance-none rounded-md bg-tse-yellow-strong py-0.5 pr-7 pl-2 text-sm font-bold text-tse-text outline-none"
            >
              {months.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-1.5 size-4 -translate-y-1/2" />
          </span>
        </label>
      </div>
      {legenda ? <p className="text-[12px] text-tse-muted">{legenda}</p> : null}
    </div>
  );
}
