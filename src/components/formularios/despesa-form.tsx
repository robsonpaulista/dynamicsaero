"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CampoConta } from "@/components/formularios/campo-conta";
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
import { CATEGORY_LABEL } from "@/lib/labels";
import { criarId, excluirDespesa, salvarDespesa } from "@/services/acoes";
import { getContaPlano, getDespesaManual, listContasPlano } from "@/services/operacao";
import type { Allocation, ContaPlano, Posting } from "@/types/operacao";

export function DespesaForm({ id }: { id?: string }) {
  const pronto = usePronto();
  if (!pronto) {
    return (
      <FormPage voltarHref="/despesas" voltar="Voltar às despesas" titulo="Despesa">
        <p className="text-[13px] text-tse-muted">Carregando o cadastro…</p>
      </FormPage>
    );
  }
  return <DespesaCampos id={id} />;
}

function DespesaCampos({ id }: { id?: string }) {
  const base = useDados();
  const router = useRouter();
  const atual = id ? getDespesaManual(id) : undefined;
  const contas = useMemo(() => listContasPlano(), [base.contas]);
  const contaInicial = atual?.contaId ? getContaPlano(atual.contaId) ?? null : null;
  const detalheInicial = (() => {
    if (!atual?.description) return "";
    if (contaInicial && atual.description.startsWith(contaInicial.nome)) {
      const resto = atual.description.slice(contaInicial.nome.length).replace(/^\s*·\s*/, "");
      return resto;
    }
    return atual.description;
  })();

  const [erro, setErro] = useState<string>("");
  const [conta, setConta] = useState<ContaPlano | null>(contaInicial);
  const [detalhe, setDetalhe] = useState<string>(detalheInicial);
  const [aircraftId, setAircraftId] = useState<string>(atual?.aircraftId ?? base.aircraft[0]?.id ?? "");
  const [date, setDate] = useState<string>(atual?.date ?? "2026-11-06");
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
    if (!conta) {
      setErro("Escolha uma conta do plano de contas.");
      return;
    }
    if (!aircraftId || !date) {
      setErro("Informe aeronave e data.");
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
    const detalheLimpo = detalhe.trim();
    const description = detalheLimpo ? `${conta.nome} · ${detalheLimpo}` : conta.nome;
    salvarDespesa({
      id: atual?.id ?? criarId("extra"),
      aircraftId,
      manual: true,
      contaId: conta.id,
      month: date.slice(0, 7),
      date,
      category: conta.category,
      description,
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
      texto="Escolha a conta no plano (fixa ou variável). O detalhe completa a descrição do lançamento."
    >
      <form onSubmit={salvar}>
        <Grade>
          <CampoConta label="Conta (plano de contas)" contas={contas} value={conta} onChange={setConta} required />
          <Campo
            label="Detalhe"
            value={detalhe}
            onChange={setDetalhe}
            placeholder="Ex.: SBGR · pouso 06/11"
          />
          {conta ? (
            <div className="rounded-xl bg-tse-bg px-3 py-2.5 text-[13px] sm:col-span-2">
              <span className="font-bold">
                {conta.grupo === "fixa" ? "Despesa fixa" : "Despesa variável"}
              </span>
              <span className="text-tse-muted"> · natureza {CATEGORY_LABEL[conta.category]}</span>
            </div>
          ) : null}
          <CampoSelect label="Aeronave" value={aircraftId} onChange={setAircraftId}>
            {base.aircraft.map((item) => (
              <option key={item.id} value={item.id}>
                {item.registration}
              </option>
            ))}
          </CampoSelect>
          <Campo label="Data" value={date} onChange={setDate} type="date" />
          <Campo label="Fornecedor" value={vendor} onChange={setVendor} />
          <Campo label="Valor (R$)" value={amount} onChange={setAmount} type="number" step="0.01" />
          <CampoSelect
            label="Rateio"
            value={allocation}
            onChange={(value) => setAllocation(value as Allocation)}
          >
            <option value="participacao">Proporcional à participação societária</option>
            <option value="solicitante">Individual de um sócio</option>
          </CampoSelect>
          {allocation === "solicitante" ? (
            <CampoSelect label="Sócio que assume" value={partnerId} onChange={setPartnerId}>
              {base.partners.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </CampoSelect>
          ) : null}
          <CampoSelect label="Posição" value={posting} onChange={(value) => setPosting(value as Posting)}>
            <option value="realizado">Faturado</option>
            <option value="previsto">Previsto</option>
            <option value="provisionado">Provisionado</option>
          </CampoSelect>
        </Grade>
        <p className="mt-3 text-[12px] text-tse-muted">
          Contas novas entram em{" "}
          <Link href="/despesas/contas" className="font-bold text-tse-olive hover:underline">
            Plano de contas
          </Link>
          . Hangar, seguro e folha também podem nascer da operação.
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
