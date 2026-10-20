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
import { AERODROMOS } from "@/data/calendario";
import { useDados, usePronto } from "@/hooks/use-dados";
import { criarId, excluirItinerario, salvarItinerario } from "@/services/acoes";
import { getItinerary } from "@/services/operacao";
import type { CrewMember, ItineraryStatus, Leg, Purpose } from "@/types/operacao";

type PernaCampo = {
  id: string;
  date: string;
  depart: string;
  arrive: string;
  fromIcao: string;
  toIcao: string;
  fromCity: string;
  toCity: string;
  blockHours: string;
  fuel: string;
  fees: string;
  handling: string;
  catering: string;
  posting: string;
};

function pernaVazia(): PernaCampo {
  return {
    id: criarId("perna"),
    date: "2026-10-20",
    depart: "08:00",
    arrive: "10:00",
    fromIcao: "SBGR",
    toIcao: "SBRJ",
    fromCity: "Guarulhos",
    toCity: "Santos Dumont",
    blockHours: "2",
    fuel: "0",
    fees: "0",
    handling: "0",
    catering: "0",
    posting: "",
  };
}

function pernaDe(leg: Leg): PernaCampo {
  return {
    id: leg.id,
    date: leg.date,
    depart: leg.depart,
    arrive: leg.arrive,
    fromIcao: leg.fromIcao,
    toIcao: leg.toIcao,
    fromCity: leg.fromCity,
    toCity: leg.toCity,
    blockHours: String(leg.blockHours),
    fuel: String(leg.fuel),
    fees: String(leg.fees),
    handling: String(leg.handling),
    catering: String(leg.catering),
    posting: leg.posting ?? "",
  };
}

function cidadeDe(icao: string, atual: string): string {
  return AERODROMOS[icao.trim().toUpperCase()] ?? atual;
}

function tripulacao(aircraftId: string, crew: CrewMember[]): { commanderId: string; copilotId?: string } {
  const assigned = crew.filter((person) => person.aircraftIds.includes(aircraftId));
  const commander = assigned.find((person) => person.role === "comandante") ?? assigned[0];
  const copilot = assigned.find((person) => person.role === "copiloto");
  return {
    commanderId: commander?.id ?? "sem-tripulacao",
    copilotId: copilot?.id,
  };
}

export function ItinerarioForm({ id }: { id?: string }) {
  const pronto = usePronto();
  if (!pronto) {
    return (
      <FormPage voltarHref="/itinerarios" voltar="Voltar aos itinerários" titulo="Itinerário">
        <p className="text-[13px] text-tse-muted">Carregando o cadastro…</p>
      </FormPage>
    );
  }
  return <ItinerarioCampos id={id} />;
}

function ItinerarioCampos({ id }: { id?: string }) {
  const base = useDados();
  const router = useRouter();
  const atual = id ? getItinerary(id) : undefined;
  const [erro, setErro] = useState<string>("");
  const [title, setTitle] = useState<string>(atual?.title ?? "");
  const [aircraftId, setAircraftId] = useState<string>(atual?.aircraftId ?? base.aircraft[0]?.id ?? "");
  const [purpose, setPurpose] = useState<Purpose>(atual?.purpose ?? "negocios");
  const [requestedBy, setRequestedBy] = useState<string>(atual?.requestedBy ?? base.partners[0]?.id ?? "");
  const [status, setStatus] = useState<ItineraryStatus>(atual?.status ?? "previsto");
  const [passengers, setPassengers] = useState<string>(atual?.passengers.join(", ") ?? "");
  const [note, setNote] = useState<string>(atual?.note ?? "");
  const [conditional, setConditional] = useState<string>(atual?.conditional ?? "");
  const [legs, setLegs] = useState<PernaCampo[]>(
    atual && atual.legs.length > 0 ? atual.legs.map(pernaDe) : [pernaVazia()],
  );

  if (id && !atual) {
    return (
      <FormPage voltarHref="/itinerarios" voltar="Voltar aos itinerários" titulo="Itinerário não encontrado">
        {null}
      </FormPage>
    );
  }

  function atualizarPerna(pernaId: string, patch: Partial<PernaCampo>) {
    setLegs((lista) => lista.map((item) => (item.id === pernaId ? { ...item, ...patch } : item)));
  }

  function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !aircraftId || !requestedBy) {
      setErro("Informe o título, a aeronave e quem pediu o voo.");
      return;
    }
    if (legs.length === 0) {
      setErro("Inclua ao menos uma perna.");
      return;
    }
    const crew = tripulacao(aircraftId, base.crew);
    const montadas: Leg[] = [];
    for (const perna of legs) {
      const horas = numeroCampo(perna.blockHours);
      const valores = [perna.fuel, perna.fees, perna.handling, perna.catering].map(numeroCampo);
      if (!perna.date || Number.isNaN(horas) || valores.some((item) => Number.isNaN(item))) {
        setErro("Revise data, horas e valores de cada perna.");
        return;
      }
      const posting = perna.posting === "realizado" || perna.posting === "previsto" || perna.posting === "provisionado"
        ? perna.posting
        : undefined;
      montadas.push({
        id: perna.id,
        date: perna.date,
        depart: perna.depart || "00:00",
        arrive: perna.arrive || "00:00",
        fromIcao: perna.fromIcao.trim().toUpperCase(),
        toIcao: perna.toIcao.trim().toUpperCase(),
        fromCity: perna.fromCity.trim() || perna.fromIcao,
        toCity: perna.toCity.trim() || perna.toIcao,
        blockHours: horas,
        fuel: valores[0] ?? 0,
        fees: valores[1] ?? 0,
        handling: valores[2] ?? 0,
        catering: valores[3] ?? 0,
        commanderId: crew.commanderId,
        copilotId: crew.copilotId,
        posting,
      });
    }
    const itineraryId = atual?.id ?? criarId("voo");
    salvarItinerario({
      id: itineraryId,
      aircraftId,
      title: title.trim(),
      purpose,
      requestedBy,
      passengers: passengers.split(",").map((item) => item.trim()).filter(Boolean),
      status,
      note: note.trim() || "Lançado na operação.",
      conditional: conditional.trim() || undefined,
      legs: montadas,
    });
    router.push(`/itinerarios/${itineraryId}`);
  }

  return (
    <FormPage
      voltarHref={atual ? `/itinerarios/${atual.id}` : "/itinerarios"}
      voltar="Voltar aos itinerários"
      titulo={atual ? `Editar ${atual.title}` : "Novo voo"}
    >
      <form onSubmit={salvar}>
        <Grade>
          <Campo label="Título" value={title} onChange={setTitle} required />
          <CampoSelect label="Aeronave" value={aircraftId} onChange={setAircraftId}>
            {base.aircraft.map((item) => (
              <option key={item.id} value={item.id}>
                {item.registration} · {item.model}
              </option>
            ))}
          </CampoSelect>
          <CampoSelect label="Finalidade" value={purpose} onChange={(value) => setPurpose(value as Purpose)}>
            <option value="negocios">Negócios</option>
            <option value="pessoal">Pessoal</option>
          </CampoSelect>
          <CampoSelect label="Quem pediu" value={requestedBy} onChange={setRequestedBy}>
            {base.partners.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </CampoSelect>
          <CampoSelect label="Situação" value={status} onChange={(value) => setStatus(value as ItineraryStatus)}>
            <option value="previsto">Previsto</option>
            <option value="confirmado">Confirmado</option>
            <option value="em_voo">Em voo</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </CampoSelect>
          <Campo label="Passageiros, separados por vírgula" value={passengers} onChange={setPassengers} />
          <CampoArea label="Nota" value={note} onChange={setNote} />
          <Campo label="Condição, se houver" value={conditional} onChange={setConditional} />
        </Grade>
        <div className="mt-5 flex items-center justify-between gap-3">
          <h3 className="text-[14px] font-bold">Pernas</h3>
          <button
            type="button"
            onClick={() => setLegs((lista) => [...lista, pernaVazia()])}
            className="text-[13px] font-bold text-tse-olive"
          >
            Adicionar perna
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {legs.map((perna, index) => (
            <fieldset key={perna.id} className="rounded-xl bg-tse-bg p-3">
              <legend className="px-1 text-[12px] font-bold tracking-wide text-tse-muted uppercase">
                Perna {index + 1}
              </legend>
              {base.rotas.length > 0 ? (
                <div className="mb-3">
                  <CampoSelect
                    label="Rota cadastrada"
                    value=""
                    onChange={(rotaId) => {
                      const rota = base.rotas.find((item) => item.id === rotaId);
                      if (!rota) return;
                      atualizarPerna(perna.id, {
                        fromIcao: rota.fromIcao,
                        toIcao: rota.toIcao,
                        fromCity: rota.fromCity,
                        toCity: rota.toCity,
                        blockHours: String(rota.blockHours),
                      });
                    }}
                  >
                    <option value="">Preencher com uma rota</option>
                    {base.rotas.map((rota) => (
                      <option key={rota.id} value={rota.id}>
                        {rota.nome}
                      </option>
                    ))}
                  </CampoSelect>
                </div>
              ) : null}
              <Grade>
                <Campo label="Data" value={perna.date} onChange={(value) => atualizarPerna(perna.id, { date: value })} type="date" />
                <CampoSelect
                  label="Lançamento"
                  value={perna.posting}
                  onChange={(value) => atualizarPerna(perna.id, { posting: value })}
                >
                  <option value="">Pela data e pela situação</option>
                  <option value="realizado">Realizado</option>
                  <option value="previsto">Previsto</option>
                  <option value="provisionado">Provisionado</option>
                </CampoSelect>
                <Campo
                  label="Origem ICAO"
                  value={perna.fromIcao}
                  onChange={(value) =>
                    atualizarPerna(perna.id, {
                      fromIcao: value.toUpperCase(),
                      fromCity: cidadeDe(value, perna.fromCity),
                    })
                  }
                />
                <Campo label="Cidade de origem" value={perna.fromCity} onChange={(value) => atualizarPerna(perna.id, { fromCity: value })} />
                <Campo
                  label="Destino ICAO"
                  value={perna.toIcao}
                  onChange={(value) =>
                    atualizarPerna(perna.id, {
                      toIcao: value.toUpperCase(),
                      toCity: cidadeDe(value, perna.toCity),
                    })
                  }
                />
                <Campo label="Cidade de destino" value={perna.toCity} onChange={(value) => atualizarPerna(perna.id, { toCity: value })} />
                <Campo label="Decolagem" value={perna.depart} onChange={(value) => atualizarPerna(perna.id, { depart: value })} />
                <Campo label="Pouso" value={perna.arrive} onChange={(value) => atualizarPerna(perna.id, { arrive: value })} />
                <Campo label="Horas de bloco" value={perna.blockHours} onChange={(value) => atualizarPerna(perna.id, { blockHours: value })} type="number" />
                <Campo label="Combustível (R$)" value={perna.fuel} onChange={(value) => atualizarPerna(perna.id, { fuel: value })} type="number" />
                <Campo label="Taxas (R$)" value={perna.fees} onChange={(value) => atualizarPerna(perna.id, { fees: value })} type="number" />
                <Campo label="Handling (R$)" value={perna.handling} onChange={(value) => atualizarPerna(perna.id, { handling: value })} type="number" />
                <Campo label="Catering (R$)" value={perna.catering} onChange={(value) => atualizarPerna(perna.id, { catering: value })} type="number" />
              </Grade>
              {legs.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setLegs((lista) => lista.filter((item) => item.id !== perna.id))}
                  className="mt-2 text-[12px] font-bold text-[#EF4444]"
                >
                  Remover perna
                </button>
              ) : null}
            </fieldset>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-tse-muted">
          Combustível, taxas, handling e catering ficam com quem pediu o voo. Comandante e copiloto saem da tripulação já escalada nessa aeronave.
        </p>
        {erro ? <ErroForm>{erro}</ErroForm> : null}
        <AcoesForm
          cancelarHref={atual ? `/itinerarios/${atual.id}` : "/itinerarios"}
          excluir={
            atual
              ? () => {
                  excluirItinerario(atual.id);
                  router.push("/itinerarios");
                }
              : undefined
          }
        />
      </form>
    </FormPage>
  );
}
