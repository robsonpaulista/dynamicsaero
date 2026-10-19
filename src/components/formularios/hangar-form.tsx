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
import { criarId, excluirHangar, salvarHangar } from "@/services/acoes";
import { getHangar } from "@/services/operacao";
import type { HangarStatus } from "@/types/operacao";

export function HangarForm({ id }: { id?: string }) {
  const pronto = usePronto();
  if (!pronto) {
    return (
      <FormPage voltarHref="/hangar" voltar="Voltar ao hangar" titulo="Hangar">
        <p className="text-[13px] text-tse-muted">Carregando o cadastro deste navegador…</p>
      </FormPage>
    );
  }
  return <HangarCampos id={id} />;
}

function HangarCampos({ id }: { id?: string }) {
  const base = useDados();
  const router = useRouter();
  const atual = id ? getHangar(id) : undefined;
  const [erro, setErro] = useState<string>("");
  const [name, setName] = useState<string>(atual?.name ?? "");
  const [airport, setAirport] = useState<string>(atual?.airport ?? "");
  const [icao, setIcao] = useState<string>(atual?.icao ?? "");
  const [slot, setSlot] = useState<string>(atual?.slot ?? "");
  const [aircraftId, setAircraftId] = useState<string>(atual?.aircraftId ?? base.aircraft[0]?.id ?? "");
  const [contract, setContract] = useState<string>(atual?.contract ?? "");
  const [contractUntil, setContractUntil] = useState<string>(atual?.contractUntil ?? "2027-12-31");
  const [monthlyFee, setMonthlyFee] = useState<string>(atual ? String(atual.monthlyFee) : "");
  const [vendor, setVendor] = useState<string>(atual?.vendor ?? "");
  const [manager, setManager] = useState<string>(atual?.manager ?? "");
  const [status, setStatus] = useState<HangarStatus>(atual?.status ?? "regular");
  const [services, setServices] = useState<string>(atual?.services.join(", ") ?? "");
  const [note, setNote] = useState<string>(atual?.note ?? "");

  if (id && !atual) {
    return <FormPage voltarHref="/hangar" voltar="Voltar ao hangar" titulo="Hangar não encontrado">{null}</FormPage>;
  }

  function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !aircraftId) {
      setErro("Informe o nome e a aeronave.");
      return;
    }
    const mensalidade = numeroCampo(monthlyFee);
    if (Number.isNaN(mensalidade) || mensalidade < 0) {
      setErro("Informe a mensalidade.");
      return;
    }
    salvarHangar({
      id: atual?.id ?? criarId("hangar"),
      name: name.trim(),
      airport: airport.trim() || icao.trim().toUpperCase(),
      icao: icao.trim().toUpperCase() || "SBGR",
      slot: slot.trim() || "Posição",
      aircraftId,
      contract: contract.trim() || "Sem número",
      contractUntil,
      monthlyFee: mensalidade,
      vendor: vendor.trim() || name.trim(),
      services: services.split(",").map((item) => item.trim()).filter(Boolean),
      manager: manager.trim() || "Operação",
      status,
      note: note.trim() || "Contrato lançado na demonstração.",
    });
    router.push("/hangar");
  }

  return (
    <FormPage voltarHref="/hangar" voltar="Voltar ao hangar" titulo={atual ? `Editar ${atual.name}` : "Novo hangar"}>
      <form onSubmit={salvar}>
        <Grade>
          <Campo label="Nome" value={name} onChange={setName} required />
          <CampoSelect label="Aeronave" value={aircraftId} onChange={setAircraftId}>
            {base.aircraft.map((item) => (
              <option key={item.id} value={item.id}>
                {item.registration}
              </option>
            ))}
          </CampoSelect>
          <Campo label="Aeroporto" value={airport} onChange={setAirport} />
          <Campo label="ICAO" value={icao} onChange={setIcao} />
          <Campo label="Posição" value={slot} onChange={setSlot} />
          <Campo label="Contrato" value={contract} onChange={setContract} />
          <Campo label="Vigência" value={contractUntil} onChange={setContractUntil} type="date" />
          <Campo label="Mensalidade (R$)" value={monthlyFee} onChange={setMonthlyFee} type="number" />
          <Campo label="Fornecedor" value={vendor} onChange={setVendor} />
          <Campo label="Operador" value={manager} onChange={setManager} />
          <CampoSelect label="Situação" value={status} onChange={(value) => setStatus(value as HangarStatus)}>
            <option value="regular">Regular</option>
            <option value="renovacao">A renovar</option>
          </CampoSelect>
          <Campo label="Serviços, separados por vírgula" value={services} onChange={setServices} />
          <CampoArea label="Nota" value={note} onChange={setNote} />
        </Grade>
        {erro ? <ErroForm>{erro}</ErroForm> : null}
        <AcoesForm
          cancelarHref="/hangar"
          excluir={
            atual
              ? () => {
                  excluirHangar(atual.id);
                  router.push("/hangar");
                }
              : undefined
          }
        />
      </form>
    </FormPage>
  );
}
