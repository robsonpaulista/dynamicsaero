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
import { criarId, excluirAeronave, salvarAeronave, salvarSocio } from "@/services/acoes";
import { getAircraft, seguroDe } from "@/services/operacao";
import type { AircraftCategory, AircraftStatus } from "@/types/operacao";

export function AeronaveForm({ id }: { id?: string }) {
  const pronto = usePronto();
  if (!pronto) {
    return (
      <FormPage voltarHref="/frota" voltar="Voltar à frota" titulo="Aeronave">
        <p className="text-[13px] text-tse-muted">Carregando o cadastro…</p>
      </FormPage>
    );
  }
  return <AeronaveCampos id={id} />;
}

function AeronaveCampos({ id }: { id?: string }) {
  const base = useDados();
  const router = useRouter();
  const atual = id ? getAircraft(id) : undefined;
  const seguro = id ? seguroDe(id) : undefined;
  const [erro, setErro] = useState<string>("");
  const [registration, setRegistration] = useState<string>(atual?.registration ?? "");
  const [manufacturer, setManufacturer] = useState<string>(atual?.manufacturer ?? "");
  const [model, setModel] = useState<string>(atual?.model ?? "");
  const [category, setCategory] = useState<AircraftCategory>(atual?.category ?? "jato");
  const [year, setYear] = useState<string>(atual ? String(atual.year) : "2024");
  const [seats, setSeats] = useState<string>(atual ? String(atual.seats) : "8");
  const [serial, setSerial] = useState<string>(atual?.serial ?? "");
  const [propulsion, setPropulsion] = useState<string>(atual?.propulsion ?? "");
  const [range, setRange] = useState<string>(atual?.range ?? "");
  const [baseIcao, setBaseIcao] = useState<string>(atual?.baseIcao ?? "SBGR");
  const [baseName, setBaseName] = useState<string>(atual?.baseName ?? "");
  const [totalHours, setTotalHours] = useState<string>(atual ? String(atual.totalHours) : "0");
  const [cycles, setCycles] = useState<string>(atual ? String(atual.cycles) : "0");
  const [status, setStatus] = useState<AircraftStatus>(atual?.status ?? "disponivel");
  const [seguroValor, setSeguroValor] = useState<string>(seguro ? String(seguro.amount) : "0");
  const [seguroVendor, setSeguroVendor] = useState<string>(seguro?.vendor ?? "AIG Aviation");
  const [fatias, setFatias] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const partner of base.partners) {
      const share = atual?.ownership.find((item) => item.partnerId === partner.id)?.share ?? 0;
      map[partner.id] = String(Math.round(share * 1000) / 10);
    }
    return map;
  });
  const [novoNome, setNovoNome] = useState<string>("");
  const [novoEmpresa, setNovoEmpresa] = useState<string>("");
  const [novoWhatsapp, setNovoWhatsapp] = useState<string>("");
  const [novoPercent, setNovoPercent] = useState<string>("");

  if (id && !atual) {
    return <FormPage voltarHref="/frota" voltar="Voltar à frota" titulo="Aeronave não encontrada">{null}</FormPage>;
  }

  function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const registro = registration.trim().toUpperCase();
    if (!registro || !manufacturer.trim() || !model.trim()) {
      setErro("Informe matrícula, fabricante e modelo.");
      return;
    }
    const duplicada = base.aircraft.some((item) => item.registration === registro && item.id !== atual?.id);
    if (duplicada) {
      setErro("Já existe uma aeronave com essa matrícula.");
      return;
    }
    const ano = numeroCampo(year);
    const lugares = numeroCampo(seats);
    const horas = numeroCampo(totalHours);
    const ciclos = numeroCampo(cycles);
    const parcela = numeroCampo(seguroValor);
    if ([ano, lugares, horas, ciclos, parcela].some((item) => Number.isNaN(item))) {
      setErro("Use números válidos em ano, lugares, horas, ciclos e seguro.");
      return;
    }

    let partners = base.partners;
    const ownership: { partnerId: string; share: number }[] = [];
    for (const partner of partners) {
      const percent = numeroCampo(fatias[partner.id] ?? "0");
      if (Number.isNaN(percent) || percent < 0) {
        setErro("A participação de cada sócio precisa ser um número positivo.");
        return;
      }
      if (percent > 0) ownership.push({ partnerId: partner.id, share: percent / 100 });
    }

    const nomeSocio = novoNome.trim();
    if (nomeSocio) {
      const percent = numeroCampo(novoPercent || "0");
      if (Number.isNaN(percent) || percent <= 0) {
        setErro("Informe a participação do sócio novo.");
        return;
      }
      if (!whatsappCompleto(novoWhatsapp)) {
        setErro("Informe o WhatsApp completo do sócio novo: +55 (11) 99999-9999.");
        return;
      }
      const partnerId = criarId("socio");
      const partner = {
        id: partnerId,
        name: nomeSocio,
        shortName: nomeSocio.split(" ")[0] ?? nomeSocio,
        company: novoEmpresa.trim() || nomeSocio,
        role: "Sócio",
        phone: mascaraWhatsapp(novoWhatsapp),
      };
      salvarSocio(partner);
      partners = [...partners, partner];
      ownership.push({ partnerId, share: percent / 100 });
    }

    const soma = ownership.reduce((total, item) => total + item.share, 0);
    if (ownership.length === 0 || Math.abs(soma - 1) > 0.011) {
      setErro("A soma das participações precisa fechar em 100%.");
      return;
    }

    const aircraftId = atual?.id ?? criarId("aeronave");
    salvarAeronave(
      {
        id: aircraftId,
        registration: registro,
        manufacturer: manufacturer.trim(),
        model: model.trim(),
        category,
        year: ano,
        seats: lugares,
        serial: serial.trim() || "—",
        propulsion: propulsion.trim() || "—",
        range: range.trim() || "—",
        baseIcao: baseIcao.trim().toUpperCase() || "SBGR",
        baseName: baseName.trim() || baseIcao.trim().toUpperCase(),
        hangarId: atual?.hangarId ?? "",
        totalHours: horas,
        cycles: ciclos,
        status,
        ownership,
      },
      {
        aircraftId,
        amount: parcela,
        vendor: seguroVendor.trim() || "Seguradora",
        description: "Casco e responsabilidade civil — parcela mensal",
      },
    );
    router.push(`/frota/${aircraftId}`);
  }

  return (
    <FormPage
      voltarHref={atual ? `/frota/${atual.id}` : "/frota"}
      voltar="Voltar à frota"
      titulo={atual ? `Editar ${atual.registration}` : "Nova aeronave"}
    >
      <form onSubmit={salvar}>
        <Grade>
          <Campo label="Matrícula" value={registration} onChange={setRegistration} required />
          <CampoSelect label="Situação" value={status} onChange={(value) => setStatus(value as AircraftStatus)}>
            <option value="disponivel">Disponível</option>
            <option value="em_voo">Em voo</option>
            <option value="manutencao">Em manutenção</option>
          </CampoSelect>
          <Campo label="Fabricante" value={manufacturer} onChange={setManufacturer} required />
          <Campo label="Modelo" value={model} onChange={setModel} required />
          <CampoSelect label="Categoria" value={category} onChange={(value) => setCategory(value as AircraftCategory)}>
            <option value="jato">Jato</option>
            <option value="helicoptero">Helicóptero</option>
          </CampoSelect>
          <Campo label="Ano" value={year} onChange={setYear} type="number" />
          <Campo label="Lugares" value={seats} onChange={setSeats} type="number" />
          <Campo label="Série" value={serial} onChange={setSerial} />
          <Campo label="Propulsão" value={propulsion} onChange={setPropulsion} />
          <Campo label="Alcance" value={range} onChange={setRange} />
          <Campo label="Base ICAO" value={baseIcao} onChange={setBaseIcao} />
          <Campo label="Cidade base" value={baseName} onChange={setBaseName} />
          <Campo label="Horas de célula" value={totalHours} onChange={setTotalHours} type="number" />
          <Campo label="Ciclos" value={cycles} onChange={setCycles} type="number" />
          <Campo label="Seguro mensal (R$)" value={seguroValor} onChange={setSeguroValor} type="number" />
          <Campo label="Seguradora" value={seguroVendor} onChange={setSeguroVendor} />
        </Grade>
        <h3 className="mt-5 text-[14px] font-bold">Participação</h3>
        <div className="mt-2 grid gap-2">
          {base.partners.map((partner) => (
            <label key={partner.id} className="grid grid-cols-[1fr_120px] items-center gap-3 text-[13px]">
              <span>{partner.name}</span>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={fatias[partner.id] ?? "0"}
                onChange={(event) =>
                  setFatias((atualFatias) => ({ ...atualFatias, [partner.id]: event.target.value }))
                }
                className="h-9 rounded-md border border-tse-border px-2 text-[13px] outline-none focus:border-tse-yellow"
              />
            </label>
          ))}
        </div>
        <h3 className="mt-5 text-[14px] font-bold">Novo sócio, se precisar</h3>
        <div className="mt-2">
          <Grade>
            <Campo label="Nome" value={novoNome} onChange={setNovoNome} />
            <Campo label="Empresa" value={novoEmpresa} onChange={setNovoEmpresa} />
            <Campo
              label="WhatsApp"
              value={novoWhatsapp}
              onChange={(value) => setNovoWhatsapp(mascaraWhatsapp(value))}
              placeholder="+55 (11) 99999-9999"
              inputMode="tel"
            />
            <Campo label="Participação (%)" value={novoPercent} onChange={setNovoPercent} type="number" />
          </Grade>
        </div>
        {erro ? <ErroForm>{erro}</ErroForm> : null}
        <AcoesForm
          cancelarHref={atual ? `/frota/${atual.id}` : "/frota"}
          excluir={
            atual
              ? () => {
                  excluirAeronave(atual.id);
                  router.push("/frota");
                }
              : undefined
          }
        />
      </form>
    </FormPage>
  );
}
