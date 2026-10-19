"use client";

import { useState } from "react";
import { useDados } from "@/hooks/use-dados";
import { baixarExcel, baixarPdf } from "@/lib/baixar-relatorio";
import { partnerName, VIEWER_ID } from "@/services/operacao";
import {
  relatorioExtrato,
  relatorioExtratos,
  relatorioPagamentos,
  relatorioPendencias,
  type Relatorio,
} from "@/services/relatorios-rateio";

export function RelatoriosRateio({ month, aircraftId }: { month: string; aircraftId: string }) {
  const socios = useDados().partners;
  const [partnerId, setPartnerId] = useState<string>(VIEWER_ID);
  const [aviso, setAviso] = useState<string>("");

  async function emitir(relatorio: Relatorio, formato: "pdf" | "excel") {
    setAviso("");
    if (formato === "excel") {
      baixarExcel(relatorio);
      return;
    }
    try {
      await baixarPdf(relatorio);
    } catch {
      setAviso("Não foi possível gerar o PDF neste navegador.");
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-[16px] font-bold">Relatórios</h2>
      <p className="mt-1 text-[13px] text-tse-muted">
        Pendências, pagamentos e extrato do recorte atual. O PDF baixa pronto e o Excel abre direto na planilha.
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Bloco
          titulo="Pendências por cotista"
          texto="Quem ainda deve nesta competência, a posição de cada um e o histórico."
          onPdf={() => emitir(relatorioPendencias(month, aircraftId), "pdf")}
          onExcel={() => emitir(relatorioPendencias(month, aircraftId), "excel")}
        />
        <Bloco
          titulo="Pagamentos realizados"
          texto="Aportes do mês e o histórico, com forma, referência e escopo."
          onPdf={() => emitir(relatorioPagamentos(month, aircraftId), "pdf")}
          onExcel={() => emitir(relatorioPagamentos(month, aircraftId), "excel")}
        />
        <div className="rounded-xl bg-tse-bg px-4 py-3">
          <h3 className="text-[14px] font-bold">Conta corrente</h3>
          <p className="mt-1 text-[13px] leading-5 text-tse-muted">
            Extrato com saldo anterior, débitos, créditos e saldo corrido. Um cotista ou todos.
          </p>
          <label className="mt-3 block text-[12px] font-bold tracking-wide text-tse-muted uppercase">
            Cotista
            <select
              value={partnerId}
              onChange={(event) => setPartnerId(event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-tse-border bg-white px-2 text-[13px] font-semibold text-tse-text outline-none"
            >
              {socios.map((item) => (
                <option key={item.id} value={item.id}>
                  {partnerName(item.id)}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Botao onClick={() => emitir(relatorioExtrato(partnerId, month, aircraftId), "pdf")}>PDF</Botao>
            <Botao claro onClick={() => emitir(relatorioExtrato(partnerId, month, aircraftId), "excel")}>
              Excel
            </Botao>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Botao onClick={() => emitir(relatorioExtratos(month, aircraftId), "pdf")}>PDF de todos</Botao>
            <Botao claro onClick={() => emitir(relatorioExtratos(month, aircraftId), "excel")}>
              Excel de todos
            </Botao>
          </div>
        </div>
      </div>
      {aviso ? <p className="mt-3 text-[13px] font-semibold text-[#EF4444]">{aviso}</p> : null}
    </section>
  );
}

function Bloco({
  titulo,
  texto,
  onPdf,
  onExcel,
}: {
  titulo: string;
  texto: string;
  onPdf: () => void;
  onExcel: () => void;
}) {
  return (
    <div className="rounded-xl bg-tse-bg px-4 py-3">
      <h3 className="text-[14px] font-bold">{titulo}</h3>
      <p className="mt-1 text-[13px] leading-5 text-tse-muted">{texto}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Botao onClick={onPdf}>PDF</Botao>
        <Botao claro onClick={onExcel}>
          Excel
        </Botao>
      </div>
    </div>
  );
}

function Botao({
  children,
  onClick,
  claro,
}: {
  children: string;
  onClick: () => void;
  claro?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center rounded-md px-3 text-[13px] font-bold ${
        claro ? "bg-white text-tse-text hover:bg-[#F4F4F2]" : "bg-tse-olive text-white hover:bg-[#1E293B]"
      }`}
    >
      {children}
    </button>
  );
}
