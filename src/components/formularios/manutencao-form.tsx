"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AcoesForm,
  Campo,
  CampoArea,
  CampoSelect,
  ErroForm,
  FormPage,
  Grade,
  numeroCampo,
} from "@/components/formularios/campos";
import { useDados, usePronto } from "@/hooks/use-dados";
import { criarId, excluirManutencao, salvarManutencao } from "@/services/acoes";
import { getMaintenance } from "@/services/operacao";
import type { MxKind, MxStatus, Posting } from "@/types/operacao";

export function ManutencaoForm({ id }: { id?: string }) {
  const pronto = usePronto();
  if (!pronto) {
    return (
      <FormPage voltarHref="/manutencao" voltar="Voltar à manutenção" titulo="Manutenção">
        <p className="text-[13px] text-tse-muted">Carregando o cadastro deste navegador…</p>
      </FormPage>
    );
  }
  return <ManutencaoCampos id={id} />;
}

function ManutencaoCampos({ id }: { id?: string }) {
  const base = useDados();
  const router = useRouter();
  const atual = id ? getMaintenance(id) : undefined;
  const [erro, setErro] = useState<string>("");
  const [title, setTitle] = useState<string>(atual?.title ?? "");
  const [aircraftId, setAircraftId] = useState<string>(atual?.aircraftId ?? base.aircraft[0]?.id ?? "");
  const [kind, setKind] = useState<MxKind>(atual?.kind ?? "preventiva");
  const [status, setStatus] = useState<MxStatus>(atual?.status ?? "proxima");
  const [system, setSystem] = useState<string>(atual?.system ?? "");
  const [openedAt, setOpenedAt] = useState<string>(atual?.openedAt ?? "2026-10-18");
  const [dueAt, setDueAt] = useState<string>(atual?.dueAt ?? "");
  const [dueLabel, setDueLabel] = useState<string>(atual?.dueLabel ?? "");
  const [remainingHours, setRemainingHours] = useState<string>(
    atual?.remainingHours === null || atual?.remainingHours === undefined ? "" : String(atual.remainingHours),
  );
  const [grounding, setGrounding] = useState<boolean>(atual?.grounding ?? false);
  const [vendor, setVendor] = useState<string>(atual?.vendor ?? "");
  const [cost, setCost] = useState<string>(atual ? String(atual.cost) : "0");
  const [estimate, setEstimate] = useState<string>(
    atual?.estimate === null || atual?.estimate === undefined ? "" : String(atual.estimate),
  );
  const [competencia, setCompetencia] = useState<string>(atual?.competencia ?? "");
  const [posting, setPosting] = useState<string>(atual?.posting ?? "");
  const [summary, setSummary] = useState<string>(atual?.summary ?? "");

  if (id && !atual) {
    return (
      <FormPage voltarHref="/manutencao" voltar="Voltar à manutenção" titulo="Ordem não encontrada">
        {null}
      </FormPage>
    );
  }

  function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !aircraftId) {
      setErro("Informe o título e a aeronave.");
      return;
    }
    const custo = numeroCampo(cost);
    const estimado = estimate.trim() ? numeroCampo(estimate) : null;
    const horas = remainingHours.trim() ? numeroCampo(remainingHours) : null;
    if (Number.isNaN(custo) || (estimado !== null && Number.isNaN(estimado)) || (horas !== null && Number.isNaN(horas))) {
      setErro("Revise custo, estimativa e horas.");
      return;
    }
    if (custo > 0 && (!competencia || !posting)) {
      setErro("Com custo informado, escolha a competência e se o valor já entrou, está previsto ou provisionado.");
      return;
    }
    const postingValor: Posting | null =
      posting === "realizado" || posting === "previsto" || posting === "provisionado" ? posting : null;
    const itemId = atual?.id ?? criarId("mx");
    salvarManutencao({
      id: itemId,
      aircraftId,
      kind,
      title: title.trim(),
      system: system.trim() || "Geral",
      status,
      openedAt,
      dueAt: dueAt || null,
      dueLabel: dueLabel.trim() || (dueAt ? dueAt : "Sem prazo definido"),
      remainingHours: horas,
      grounding,
      vendor: vendor.trim() || "Oficina",
      cost: custo,
      estimate: estimado,
      competencia: competencia || null,
      posting: postingValor,
      summary: summary.trim() || "Ordem lançada na operação.",
    });
    router.push(`/manutencao/${itemId}`);
  }

  return (
    <FormPage
      voltarHref={atual ? `/manutencao/${atual.id}` : "/manutencao"}
      voltar="Voltar à manutenção"
      titulo={atual ? `Editar ${atual.title}` : "Nova manutenção"}
    >
      <form onSubmit={salvar}>
        <Grade>
          <Campo label="Título" value={title} onChange={setTitle} required />
          <CampoSelect label="Aeronave" value={aircraftId} onChange={setAircraftId}>
            {base.aircraft.map((item) => (
              <option key={item.id} value={item.id}>
                {item.registration}
              </option>
            ))}
          </CampoSelect>
          <CampoSelect label="Tipo" value={kind} onChange={(value) => setKind(value as MxKind)}>
            <option value="preventiva">Preventiva</option>
            <option value="corretiva">Corretiva</option>
          </CampoSelect>
          <CampoSelect label="Andamento" value={status} onChange={(value) => setStatus(value as MxStatus)}>
            <option value="em_execucao">Em execução</option>
            <option value="proxima">Próxima</option>
            <option value="em_dia">Em dia</option>
            <option value="concluida">Concluída</option>
          </CampoSelect>
          <Campo label="Sistema" value={system} onChange={setSystem} />
          <Campo label="Oficina" value={vendor} onChange={setVendor} />
          <Campo label="Aberta em" value={openedAt} onChange={setOpenedAt} type="date" />
          <Campo label="Prazo" value={dueAt} onChange={setDueAt} type="date" />
          <Campo label="Como o prazo aparece" value={dueLabel} onChange={setDueLabel} />
          <Campo label="Horas restantes" value={remainingHours} onChange={setRemainingHours} type="number" />
          <Campo label="Custo (R$)" value={cost} onChange={setCost} type="number" />
          <Campo label="Estimativa (R$)" value={estimate} onChange={setEstimate} type="number" />
          <Campo label="Competência" value={competencia} onChange={setCompetencia} type="month" />
          <CampoSelect label="Lançamento do custo" value={posting} onChange={setPosting}>
            <option value="">Ainda fora do rateio</option>
            <option value="realizado">Realizado</option>
            <option value="previsto">Previsto</option>
            <option value="provisionado">Provisionado</option>
          </CampoSelect>
          <CampoArea label="Resumo" value={summary} onChange={setSummary} />
        </Grade>
        <label className="mt-3 flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={grounding} onChange={(event) => setGrounding(event.target.checked)} />
          Esta ordem retém a aeronave
        </label>
        {erro ? <ErroForm>{erro}</ErroForm> : null}
        <AcoesForm
          cancelarHref={atual ? `/manutencao/${atual.id}` : "/manutencao"}
          excluir={
            atual
              ? () => {
                  excluirManutencao(atual.id);
                  router.push("/manutencao");
                }
              : undefined
          }
        />
      </form>
    </FormPage>
  );
}
