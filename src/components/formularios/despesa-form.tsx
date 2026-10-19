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
import { useDados, usePronto } from "@/hooks/use-dados";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/labels";
import { criarId, excluirDespesa, salvarDespesa } from "@/services/acoes";
import { getDespesaManual } from "@/services/operacao";
import type { Allocation, ExpenseCategory, Posting } from "@/types/operacao";

export function DespesaForm({ id }: { id?: string }) {
  const pronto = usePronto();
  if (!pronto) {
    return (
      <FormPage voltarHref="/despesas" voltar="Voltar às despesas" titulo="Despesa">
        <p className="text-[13px] text-tse-muted">Carregando o cadastro deste navegador…</p>
      </FormPage>
    );
  }
  return <DespesaCampos id={id} />;
}

function DespesaCampos({ id }: { id?: string }) {
  const base = useDados();
  const router = useRouter();
  const atual = id ? getDespesaManual(id) : undefined;
  const [erro, setErro] = useState<string>("");
  const [description, setDescription] = useState<string>(atual?.description ?? "");
  const [aircraftId, setAircraftId] = useState<string>(atual?.aircraftId ?? base.aircraft[0]?.id ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(atual?.category ?? "administrativo");
  const [date, setDate] = useState<string>(atual?.date ?? "2026-10-18");
  const [vendor, setVendor] = useState<string>(atual?.vendor ?? "");
  const [amount, setAmount] = useState<string>(atual ? String(atual.amount) : "");
  const [allocation, setAllocation] = useState<Allocation>(atual?.allocation ?? "participacao");
  const [partnerId, setPartnerId] = useState<string>(atual?.partnerId ?? base.partners[0]?.id ?? "");
  const [posting, setPosting] = useState<Posting>(atual?.posting ?? "realizado");

  if (id && !atual) {
    return (
      <FormPage voltarHref="/despesas" voltar="Voltar às despesas" titulo="Despesa não editável aqui">
        <p className="text-[13px] text-tse-muted">
          Este lançamento nasce de um voo, de um hangar, da folha, do seguro ou de uma ordem de manutenção.
          Altere a origem para o rateio acompanhar.
        </p>
      </FormPage>
    );
  }

  function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valor = numeroCampo(amount);
    if (!description.trim() || !aircraftId || !date) {
      setErro("Informe descrição, aeronave e data.");
      return;
    }
    if (Number.isNaN(valor) || valor <= 0) {
      setErro("Informe um valor maior que zero.");
      return;
    }
    if (allocation === "solicitante" && !partnerId) {
      setErro("Escolha o sócio que assume esta despesa.");
      return;
    }
    salvarDespesa({
      id: atual?.id ?? criarId("extra"),
      aircraftId,
      manual: true,
      month: date.slice(0, 7),
      date,
      category,
      description: description.trim(),
      vendor: vendor.trim() || "Lançamento manual",
      amount: valor,
      allocation,
      partnerId: allocation === "solicitante" ? partnerId : undefined,
      posting,
    });
    router.push("/despesas");
  }

  return (
    <FormPage
      voltarHref="/despesas"
      voltar="Voltar às despesas"
      titulo={atual ? "Editar despesa avulsa" : "Nova despesa avulsa"}
    >
      <form onSubmit={salvar}>
        <Grade>
          <Campo label="Descrição" value={description} onChange={setDescription} required />
          <CampoSelect label="Aeronave" value={aircraftId} onChange={setAircraftId}>
            {base.aircraft.map((item) => (
              <option key={item.id} value={item.id}>
                {item.registration}
              </option>
            ))}
          </CampoSelect>
          <CampoSelect label="Natureza" value={category} onChange={(value) => setCategory(value as ExpenseCategory)}>
            {CATEGORY_ORDER.map((item) => (
              <option key={item} value={item}>
                {CATEGORY_LABEL[item]}
              </option>
            ))}
          </CampoSelect>
          <Campo label="Data" value={date} onChange={setDate} type="date" />
          <Campo label="Fornecedor" value={vendor} onChange={setVendor} />
          <Campo label="Valor (R$)" value={amount} onChange={setAmount} type="number" />
          <CampoSelect label="Rateio" value={allocation} onChange={(value) => setAllocation(value as Allocation)}>
            <option value="participacao">Pela participação</option>
            <option value="solicitante">Um sócio assume</option>
          </CampoSelect>
          {allocation === "solicitante" ? (
            <CampoSelect label="Sócio" value={partnerId} onChange={setPartnerId}>
              {base.partners.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </CampoSelect>
          ) : null}
          <CampoSelect label="Situação" value={posting} onChange={(value) => setPosting(value as Posting)}>
            <option value="realizado">Realizado</option>
            <option value="previsto">Previsto</option>
            <option value="provisionado">Provisionado</option>
          </CampoSelect>
        </Grade>
        <p className="mt-3 text-[12px] text-tse-muted">
          Use isto para o que não nasce de um voo, do hangar, da folha, do seguro ou da oficina.
        </p>
        {erro ? <ErroForm>{erro}</ErroForm> : null}
        <AcoesForm
          cancelarHref="/despesas"
          excluir={
            atual
              ? () => {
                  excluirDespesa(atual.id);
                  router.push("/despesas");
                }
              : undefined
          }
        />
      </form>
    </FormPage>
  );
}
