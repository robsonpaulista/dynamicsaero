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
import { mascaraWhatsapp, whatsappCompleto } from "@/lib/telefone";
import { criarId, excluirSocio, excluirTripulante, salvarSocio, salvarTripulante } from "@/services/acoes";
import { getCrew, getPartner } from "@/services/operacao";
import type { CrewRole, CrewStatus } from "@/types/operacao";

type Vinculo = CrewRole | "cotista";

export function PessoalForm({ id }: { id?: string }) {
  const pronto = usePronto();
  if (!pronto) {
    return (
      <FormPage voltarHref="/pessoal" voltar="Voltar ao pessoal" titulo="Pessoa">
        <p className="text-[13px] text-tse-muted">Carregando o cadastro deste navegador…</p>
      </FormPage>
    );
  }
  return <PessoalCampos id={id} />;
}

function PessoalCampos({ id }: { id?: string }) {
  const base = useDados();
  const router = useRouter();
  const atual = id ? getCrew(id) : undefined;
  const socio = id && !atual ? getPartner(id) : undefined;
  const [erro, setErro] = useState<string>("");
  const [vinculo, setVinculo] = useState<Vinculo>(socio ? "cotista" : (atual?.role ?? "comandante"));
  const [name, setName] = useState<string>(socio?.name ?? atual?.name ?? "");
  const [shortName, setShortName] = useState<string>(socio?.shortName ?? "");
  const [company, setCompany] = useState<string>(socio?.company ?? "");
  const [papel, setPapel] = useState<string>(socio?.role ?? "Cotista / sócio");
  const [phone, setPhone] = useState<string>(socio?.phone ? mascaraWhatsapp(socio.phone) : "");
  const [status, setStatus] = useState<CrewStatus>(atual?.status ?? "ativo");
  const [baseNome, setBaseNome] = useState<string>(atual?.base ?? "");
  const [documentLabel, setDocumentLabel] = useState<string>(atual?.documentLabel ?? "Licença");
  const [documentExpiry, setDocumentExpiry] = useState<string>(atual?.documentExpiry ?? "2027-12-31");
  const [medicalLabel, setMedicalLabel] = useState<string>(atual?.medicalLabel ?? "");
  const [medicalExpiry, setMedicalExpiry] = useState<string>(atual?.medicalExpiry ?? "");
  const [monthlyCost, setMonthlyCost] = useState<string>(atual ? String(atual.monthlyCost) : "");
  const [nextDuty, setNextDuty] = useState<string>(atual?.nextDuty ?? "");
  const [aircraftIds, setAircraftIds] = useState<string[]>(atual?.aircraftIds ?? []);

  if (id && !atual && !socio) {
    return <FormPage voltarHref="/pessoal" voltar="Voltar ao pessoal" titulo="Pessoa não encontrada">{null}</FormPage>;
  }

  function alternarAeronave(aircraftId: string) {
    setAircraftIds((lista) =>
      lista.includes(aircraftId) ? lista.filter((item) => item !== aircraftId) : [...lista, aircraftId],
    );
  }

  function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setErro("Informe o nome.");
      return;
    }
    if (vinculo === "cotista") {
      if (!company.trim()) {
        setErro("Informe a empresa do cotista.");
        return;
      }
      if (!whatsappCompleto(phone)) {
        setErro("Informe o WhatsApp completo: +55 (11) 99999-9999.");
        return;
      }
      const curto = shortName.trim() || name.trim().split(" ")[0] || name.trim();
      salvarSocio({
        id: socio?.id ?? criarId("socio"),
        name: name.trim(),
        shortName: curto,
        company: company.trim(),
        role: papel.trim() || "Cotista / sócio",
        phone: mascaraWhatsapp(phone),
      });
      router.push("/pessoal");
      return;
    }
    const custo = numeroCampo(monthlyCost);
    if (Number.isNaN(custo) || custo < 0) {
      setErro("Informe o custo mensal.");
      return;
    }
    if (!documentExpiry) {
      setErro("Informe o vencimento do documento.");
      return;
    }
    salvarTripulante({
      id: atual?.id ?? criarId("pessoa"),
      name: name.trim(),
      role: vinculo,
      base: baseNome.trim() || "São Paulo",
      aircraftIds,
      documentLabel: documentLabel.trim() || "Documento",
      documentExpiry,
      medicalLabel: medicalLabel.trim() || null,
      medicalExpiry: medicalExpiry || null,
      monthlyCost: custo,
      status,
      nextDuty: nextDuty.trim() || "Sem escala definida",
    });
    router.push("/pessoal");
  }

  return (
    <FormPage
      voltarHref="/pessoal"
      voltar="Voltar ao pessoal"
      titulo={socio ? `Editar ${socio.name}` : atual ? `Editar ${atual.name}` : "Nova pessoa"}
    >
      <form onSubmit={salvar}>
        <Grade>
          <Campo label="Nome" value={name} onChange={setName} required />
          <CampoSelect
            label="Função"
            value={vinculo}
            onChange={(value) => setVinculo(value as Vinculo)}
          >
            <option value="comandante" disabled={Boolean(socio)}>
              Comandante
            </option>
            <option value="copiloto" disabled={Boolean(socio)}>
              Copiloto
            </option>
            <option value="mecanico" disabled={Boolean(socio)}>
              Mecânico
            </option>
            <option value="gestor" disabled={Boolean(socio)}>
              Gestão
            </option>
            <option value="cotista" disabled={Boolean(atual)}>
              Cotista / sócio
            </option>
          </CampoSelect>
          {vinculo === "cotista" ? (
            <>
              <Campo label="Nome curto" value={shortName} onChange={setShortName} />
              <Campo label="Empresa" value={company} onChange={setCompany} required />
              <Campo label="Papel" value={papel} onChange={setPapel} />
              <Campo
                label="WhatsApp"
                value={phone}
                onChange={(value) => setPhone(mascaraWhatsapp(value))}
                placeholder="+55 (11) 99999-9999"
                inputMode="tel"
                required
              />
            </>
          ) : (
            <>
              <CampoSelect label="Situação" value={status} onChange={(value) => setStatus(value as CrewStatus)}>
                <option value="ativo">Ativo</option>
                <option value="ferias">Férias</option>
                <option value="treinamento">Treinamento</option>
              </CampoSelect>
              <Campo label="Base" value={baseNome} onChange={setBaseNome} />
              <Campo label="Documento" value={documentLabel} onChange={setDocumentLabel} />
              <Campo label="Vencimento" value={documentExpiry} onChange={setDocumentExpiry} type="date" />
              <Campo label="Exame médico" value={medicalLabel} onChange={setMedicalLabel} />
              <Campo label="Vencimento do exame" value={medicalExpiry} onChange={setMedicalExpiry} type="date" />
              <Campo label="Custo mensal (R$)" value={monthlyCost} onChange={setMonthlyCost} type="number" />
              <Campo label="Próxima escala" value={nextDuty} onChange={setNextDuty} />
            </>
          )}
        </Grade>
        {vinculo === "cotista" ? (
          <p className="mt-4 text-[13px] text-tse-muted">
            A participação em cada aeronave continua no cadastro da frota.
          </p>
        ) : (
          <fieldset className="mt-4">
            <legend className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">Aeronaves</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {base.aircraft.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={aircraftIds.includes(item.id)}
                    onChange={() => alternarAeronave(item.id)}
                  />
                  {item.registration}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {erro ? <ErroForm>{erro}</ErroForm> : null}
        <AcoesForm
          cancelarHref="/pessoal"
          excluir={
            socio
              ? () => {
                  const motivo = excluirSocio(socio.id);
                  if (motivo) {
                    setErro(motivo);
                    return;
                  }
                  router.push("/pessoal");
                }
              : atual
                ? () => {
                    excluirTripulante(atual.id);
                    router.push("/pessoal");
                  }
                : undefined
          }
        />
      </form>
    </FormPage>
  );
}
