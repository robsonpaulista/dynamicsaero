"use client";

import { useState } from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { baixarExcel, baixarPdf } from "@/lib/baixar-relatorio";
import type { Relatorio } from "@/services/relatorios-rateio";

export function AcoesRelatorio({
  titulo,
  texto,
  gerar,
}: {
  titulo: string;
  texto: string;
  gerar: () => Relatorio;
}) {
  const [aviso, setAviso] = useState<string>("");
  const [gerando, setGerando] = useState<"pdf" | "excel" | null>(null);

  async function emitir(formato: "pdf" | "excel") {
    setAviso("");
    setGerando(formato);
    try {
      const relatorio = gerar();
      if (formato === "excel") {
        baixarExcel(relatorio);
        return;
      }
      await baixarPdf(relatorio);
    } catch {
      setAviso(
        formato === "pdf"
          ? "Não foi possível gerar o PDF neste navegador."
          : "Não foi possível gerar o Excel neste navegador.",
      );
    } finally {
      setGerando(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E8E4F5] bg-white shadow-sm">
      <div className="bg-[#E8E4F5] px-4 py-3 sm:px-5">
        <h2 className="text-[15px] font-bold text-[#4F4270]">{titulo}</h2>
        <p className="mt-1 text-[13px] text-tse-muted">{texto}</p>
      </div>
      <div className="flex flex-wrap gap-2 p-4 sm:px-5">
        <button
          type="button"
          disabled={gerando !== null}
          onClick={() => void emitir("pdf")}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#6B5B95] px-4 text-[13px] font-bold text-white hover:bg-[#4F4270] disabled:opacity-60"
        >
          <FileDown className="size-4" aria-hidden />
          {gerando === "pdf" ? "Gerando…" : "PDF"}
        </button>
        <button
          type="button"
          disabled={gerando !== null}
          onClick={() => void emitir("excel")}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-bold text-[#6B5B95] ring-1 ring-[#6B5B95]/30 hover:bg-[#E8E4F5] disabled:opacity-60"
        >
          <FileSpreadsheet className="size-4" aria-hidden />
          {gerando === "excel" ? "Gerando…" : "Excel"}
        </button>
      </div>
      {aviso ? <p className="mt-3 text-[13px] font-semibold text-[#EF4444]">{aviso}</p> : null}
    </section>
  );
}
