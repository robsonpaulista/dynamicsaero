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
    <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-[16px] font-bold">{titulo}</h2>
      <p className="mt-1 text-[13px] text-tse-muted">{texto}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={gerando !== null}
          onClick={() => void emitir("pdf")}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-tse-olive px-3 text-[13px] font-bold text-white hover:bg-[#1E293B] disabled:opacity-60"
        >
          <FileDown className="size-4" aria-hidden />
          {gerando === "pdf" ? "Gerando…" : "PDF"}
        </button>
        <button
          type="button"
          disabled={gerando !== null}
          onClick={() => void emitir("excel")}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-white px-3 text-[13px] font-bold text-tse-text ring-1 ring-[#EEF0F3] hover:bg-[#F4F4F2] disabled:opacity-60"
        >
          <FileSpreadsheet className="size-4" aria-hidden />
          {gerando === "excel" ? "Gerando…" : "Excel"}
        </button>
      </div>
      {aviso ? <p className="mt-3 text-[13px] font-semibold text-[#EF4444]">{aviso}</p> : null}
    </section>
  );
}
