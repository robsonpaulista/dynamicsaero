"use client";

import { useState } from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { baixarExcel, baixarPdf } from "@/lib/baixar-relatorio";
import type { Relatorio } from "@/services/relatorios-rateio";

export function AcoesRelatorio({
  titulo,
  texto,
  gerar,
  gerarPdf,
}: {
  titulo: string;
  texto: string;
  gerar: () => Relatorio;
  /** PDF dedicado (layout da tela). Se omitido, usa o gerador genérico. */
  gerarPdf?: () => Promise<void>;
}) {
  const [aviso, setAviso] = useState<string>("");
  const [gerando, setGerando] = useState<"pdf" | "excel" | null>(null);

  async function emitir(formato: "pdf" | "excel") {
    setAviso("");
    setGerando(formato);
    try {
      if (formato === "pdf" && gerarPdf) {
        await gerarPdf();
        return;
      }
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
    <section className="overflow-hidden rounded-2xl border border-[#FFF8E0] bg-white shadow-sm">
      <div className="bg-[#FFF8E0] px-4 py-3 sm:px-5">
        <h2 className="text-[15px] font-bold text-[#3D3D3C]">{titulo}</h2>
        <p className="mt-1 text-[13px] text-tse-muted">{texto}</p>
      </div>
      <div className="flex flex-wrap gap-2 p-4 sm:px-5">
        <button
          type="button"
          disabled={gerando !== null}
          onClick={() => void emitir("pdf")}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-tse-olive px-4 text-[13px] font-bold text-tse-text hover:bg-tse-yellow-strong disabled:opacity-60"
        >
          <FileDown className="size-4" aria-hidden />
          {gerando === "pdf" ? "Gerando…" : "PDF"}
        </button>
        <button
          type="button"
          disabled={gerando !== null}
          onClick={() => void emitir("excel")}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-bold text-tse-gold ring-1 ring-tse-yellow/35 hover:bg-tse-soft disabled:opacity-60"
        >
          <FileSpreadsheet className="size-4" aria-hidden />
          {gerando === "excel" ? "Gerando…" : "Excel"}
        </button>
      </div>
      {aviso ? <p className="mt-3 text-[13px] font-semibold text-[#EF4444]">{aviso}</p> : null}
    </section>
  );
}
