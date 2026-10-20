"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AcoesForm,
  Campo,
  CampoSelect,
  ErroForm,
  FormPage,
  Grade,
  numeroCampo,
} from "@/components/formularios/campos";
import { useOperacao } from "@/context/operacao-context";
import { useDados, usePronto } from "@/hooks/use-dados";
import { METODO_LABEL } from "@/lib/labels";
import { criarId, excluirAporte, salvarAporte } from "@/services/acoes";
import { getAporte } from "@/services/operacao";
import type { AporteMetodo } from "@/types/operacao";

export function AporteForm({ id }: { id?: string }) {
  const pronto = usePronto();
  if (!pronto) {
    return (
      <FormPage voltarHref="/rateio" voltar="Voltar ao rateio" titulo="Aporte">
        <p className="text-[13px] text-tse-muted">Carregando o cadastro…</p>
      </FormPage>
    );
  }
  return <AporteCampos id={id} />;
}

function AporteCampos({ id }: { id?: string }) {
  const base = useDados();
  const router = useRouter();
  const { month } = useOperacao();
  const atual = id ? getAporte(id) : undefined;
  const [erro, setErro] = useState<string>("");
  const [partnerId, setPartnerId] = useState<string>(atual?.partnerId ?? base.partners[0]?.id ?? "");
  const [competencia, setCompetencia] = useState<string>(atual?.month ?? month);
  const [date, setDate] = useState<string>(atual?.date ?? `${month}-05`);
  const [amount, setAmount] = useState<string>(atual ? String(atual.amount) : "");
  const [method, setMethod] = useState<AporteMetodo>(atual?.method ?? "pix");
  const [reference, setReference] = useState<string>(atual?.reference ?? "");
  const [aircraftId, setAircraftId] = useState<string>(atual?.aircraftId ?? "");
  const [note, setNote] = useState<string>(atual?.note ?? "");

  if (id && !atual) {
    return (
      <FormPage voltarHref="/rateio" voltar="Voltar ao rateio" titulo="Aporte não encontrado">
        {null}
      </FormPage>
    );
  }

  function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valor = numeroCampo(amount);
    if (!partnerId || !/^\d{4}-\d{2}$/.test(competencia) || !date) {
      setErro("Informe o cotista, a competência e a data.");
      return;
    }
    if (Number.isNaN(valor) || valor <= 0) {
      setErro("Informe um valor maior que zero.");
      return;
    }
    salvarAporte({
      id: atual?.id ?? criarId("aporte"),
      partnerId,
      month: competencia,
      date,
      amount: valor,
      method,
      reference: reference.trim(),
      note: note.trim() || "Aporte",
      aircraftId: aircraftId || null,
    });
    router.push("/rateio");
  }

  return (
    <FormPage
      voltarHref="/rateio"
      voltar="Voltar ao rateio"
      titulo={atual ? "Editar aporte" : "Novo aporte"}
    >
      <form onSubmit={salvar}>
        <Grade>
          <CampoSelect label="Cotista" value={partnerId} onChange={setPartnerId}>
            {base.partners.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </CampoSelect>
          <Campo label="Competência" value={competencia} onChange={setCompetencia} type="month" />
          <Campo label="Data do pagamento" value={date} onChange={setDate} type="date" />
          <Campo label="Valor (R$)" value={amount} onChange={setAmount} type="number" />
          <CampoSelect label="Forma" value={method} onChange={(value) => setMethod(value as AporteMetodo)}>
            {(Object.keys(METODO_LABEL) as AporteMetodo[]).map((item) => (
              <option key={item} value={item}>
                {METODO_LABEL[item]}
              </option>
            ))}
          </CampoSelect>
          <Campo label="Referência" value={reference} onChange={setReference} />
          <CampoSelect label="Escopo" value={aircraftId} onChange={setAircraftId}>
            <option value="">Operação inteira</option>
            {base.aircraft.map((item) => (
              <option key={item.id} value={item.id}>
                {item.registration}
              </option>
            ))}
          </CampoSelect>
          <Campo label="Nota" value={note} onChange={setNote} />
        </Grade>
        <p className="mt-3 text-[12px] text-tse-muted">
          Um aporte da operação inteira abate a conta do cotista no mês. Se marcar uma aeronave, ele só entra no recorte dela.
        </p>
        {erro ? <ErroForm>{erro}</ErroForm> : null}
        <AcoesForm
          cancelarHref="/rateio"
          excluir={
            atual
              ? () => {
                  excluirAporte(atual.id);
                  router.push("/rateio");
                }
              : undefined
          }
        />
      </form>
    </FormPage>
  );
}
