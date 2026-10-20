"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { PageStack } from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import {
  abrirConversa,
  identificarTelefone,
  responderAgente,
  type OpcaoAgente,
  type RascunhoVoo,
} from "@/services/agente-whatsapp";
import { listPartners, VIEWER_ID } from "@/services/operacao";

type Bolha = {
  id: string;
  autor: "pessoa" | "agente";
  texto: string;
};

const NUMERO_FORA = "11900000000";

const TITULOS_AGENDA = new Set(["Agendados", "Realizados", "Cancelados"]);

function classeDoTitulo(linha: string): string {
  if (linha === "Cancelados") return "bg-[#FEF2F2] text-[#EF4444]";
  if (linha === "Agendados") return "bg-[#E0F2FE] text-[#0F172A]";
  return "bg-[#F1F5F9] text-tse-text";
}

function TextoDaBolha({ texto }: { texto: string }) {
  const linhas = texto.split("\n");
  return linhas.map((linha, indice) => {
    if (linha === "") return <span key={indice} className="block h-2" />;
    if (TITULOS_AGENDA.has(linha)) {
      return (
        <span key={indice} className="mt-1 mb-1 block">
          <span
            className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase ${classeDoTitulo(linha)}`}
          >
            {linha}
          </span>
        </span>
      );
    }
    return (
      <span key={indice} className="block">
        {linha}
      </span>
    );
  });
}

export function AgenteView() {
  useDados();
  const { month } = useOperacao();
  const socios = listPartners();
  const inicial = socios.find((item) => item.id === VIEWER_ID)?.phone || socios[0]?.phone || NUMERO_FORA;
  const [telefone, setTelefone] = useState<string>(inicial);

  return (
    <PageStack>
      <FiltrosOperacao legenda="A simulação usa a competência escolhida. No WhatsApp real, o mês segue a data da conversa." />
      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,440px)]">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-[16px] font-bold">Simulação do WhatsApp</h2>
          <p className="mt-2 text-[13px] leading-5 text-tse-muted">
            O agente reconhece a pessoa pelo número cadastrado em Pessoal. Por enquanto o canal é este
            bate-papo. Os sócios veem a frota, a agenda de todos, o próprio extrato e podem agendar um voo
            se o horário e a aeronave estiverem livres.
          </p>
          <label className="mt-4 block text-[12px] font-bold tracking-wide text-tse-muted uppercase">
            Número que está falando
            <select
              value={telefone}
              onChange={(event) => setTelefone(event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-tse-border bg-white px-2 text-[13px] font-semibold text-tse-text normal-case outline-none"
            >
              {socios.map((item) => (
                <option key={item.id} value={item.phone || item.id} disabled={!item.phone}>
                  {item.name}
                  {item.phone ? ` · ${item.phone}` : " · sem WhatsApp"}
                </option>
              ))}
              <option value={NUMERO_FORA}>Número não cadastrado · +55 (11) 90000-0000</option>
            </select>
          </label>
        </section>
        <Conversa key={telefone} telefone={telefone} month={month} />
      </div>
    </PageStack>
  );
}

function Conversa({ telefone, month }: { telefone: string; month: string }) {
  const identidade = identificarTelefone(telefone);
  const abertura = abrirConversa(identidade, month);
  const [seq, setSeq] = useState<number>(1);
  const [rascunho, setRascunho] = useState<string>("");
  const [pedidoVoo, setPedidoVoo] = useState<RascunhoVoo | null>(null);
  const [opcoes, setOpcoes] = useState<OpcaoAgente[]>(abertura.opcoes);
  const [bolhas, setBolhas] = useState<Bolha[]>([
    { id: "abertura", autor: "agente", texto: abertura.texto },
  ]);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [bolhas]);

  function enviar(texto: string) {
    const pedido = texto.trim();
    if (!pedido) return;
    const resposta = responderAgente(identidade, month, pedido, pedidoVoo);
    setPedidoVoo(resposta.rascunho);
    const pessoa = seq + 1;
    const agente = seq + 2;
    setSeq(agente);
    setBolhas((atual) => [
      ...atual,
      { id: `pessoa-${pessoa}`, autor: "pessoa", texto: pedido },
      { id: `agente-${agente}`, autor: "agente", texto: resposta.texto },
    ]);
    setOpcoes(resposta.opcoes);
    setRascunho("");
  }

  function aoEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    enviar(rascunho);
  }

  return (
    <section className="flex h-[640px] flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
      <header className="border-b border-[#EEEEEE] px-4 py-3">
        <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">Dynamics Aero</p>
        <h2 className="text-[16px] font-bold">Agente</h2>
        <p className="text-[12px] text-tse-muted">
          {identidade.papel === "socio" ? identidade.nome : "Número não cadastrado"}
        </p>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto bg-tse-bg px-3 py-4">
        {bolhas.map((bolha) => (
          <p
            key={bolha.id}
            className={`max-w-[92%] rounded-2xl px-3 py-2 text-[14px] leading-5 whitespace-pre-wrap ${
              bolha.autor === "pessoa"
                ? "ml-auto bg-tse-soft text-tse-text"
                : "bg-white text-tse-text shadow-sm"
            }`}
          >
            <TextoDaBolha texto={bolha.texto} />
          </p>
        ))}
        {opcoes.length > 0 ? (
          <div className="flex flex-col gap-2">
            {opcoes.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                onClick={() => enviar(opcao.rotulo)}
                className="rounded-full border border-tse-olive bg-white px-3 py-2 text-left text-[13px] font-bold text-tse-olive hover:bg-[#F1F5F9]"
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
        ) : null}
        <div ref={fim} />
      </div>
      <form onSubmit={aoEnviar} className="flex gap-2 border-t border-[#EEEEEE] p-3">
        <input
          value={rascunho}
          onChange={(event) => setRascunho(event.target.value)}
          placeholder="Escreva ou escolha o menu"
          className="h-10 min-w-0 flex-1 rounded-full border border-tse-border px-4 text-[14px] outline-none focus:border-tse-yellow"
        />
        <button
          type="submit"
          className="h-10 rounded-full bg-tse-olive px-4 text-[13px] font-bold text-white hover:bg-[#1E293B]"
        >
          Enviar
        </button>
      </form>
    </section>
  );
}
