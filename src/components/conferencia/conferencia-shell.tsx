"use client";

import { useState } from "react";
import { ConferenciaVibraView } from "@/components/conferencia/conferencia-vibra-view";
import { ConferenciaView } from "@/components/conferencia/conferencia-view";

type Modo = "prestacao" | "vibra-data";

export function ConferenciaShell() {
  const [modo, setModo] = useState<Modo>("prestacao");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setModo("prestacao")}
          aria-pressed={modo === "prestacao"}
          className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
            modo === "prestacao"
              ? "bg-tse-olive text-white"
              : "bg-[#F0F2F4] text-tse-muted hover:text-tse-text"
          }`}
        >
          Prestação · FIFO + taxas
        </button>
        <button
          type="button"
          onClick={() => setModo("vibra-data")}
          aria-pressed={modo === "vibra-data"}
          className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
            modo === "vibra-data"
              ? "bg-tse-olive text-white"
              : "bg-[#F0F2F4] text-tse-muted hover:text-tse-text"
          }`}
        >
          Vibra · data do documento
        </button>
      </div>
      {modo === "prestacao" ? <ConferenciaView /> : <ConferenciaVibraView />}
    </div>
  );
}
