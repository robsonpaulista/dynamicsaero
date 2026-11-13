"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CampoAerodromo } from "@/components/formularios/campo-aerodromo";
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
import { cidadeAerodromo } from "@/services/operacao";
import { useDados, usePronto } from "@/hooks/use-dados";
import { formatBRL } from "@/lib/format";
import { criarId, excluirItinerario, salvarItinerario } from "@/services/acoes";
import {
  consumoMedioGph,
  getItinerary,
  litrosConsumidosTrecho,
  partnerShort,
  posseDoDia,
  precoPorLitroAbastecimento,
} from "@/services/operacao";
import type { AbastecimentoVoo, CrewMember, ItineraryStatus, Leg, Purpose } from "@/types/operacao";

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
  fees: string;
  handling: string;
  catering: string;
  posting: string;
};

function pernaVazia(): PernaCampo {
  return {
    id: criarId("perna"),
    date: "2026-11-06",
    depart: "08:00",
    arrive: "10:00",
    fromIcao: "",
    toIcao: "",
    fromCity: "",
    toCity: "",
    blockHours: "",
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
    fees: String(leg.fees),
    handling: String(leg.handling),
    catering: String(leg.catering),
    posting: leg.posting ?? "",
  };
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

/** Título interno a partir das pernas (origem → destino), sem campo no formulário. */
function tituloDoVoo(legs: Leg[]): string {
  const primeiro = legs[0];
  const ultimo = legs[legs.length - 1];
  if (!primeiro || !ultimo) return "Voo";
  const origem = primeiro.fromCity.trim() || primeiro.fromIcao;
  const destinoIda = primeiro.toCity.trim() || primeiro.toIcao;
  const destinoFim = ultimo.toCity.trim() || ultimo.toIcao;
  if (legs.length > 1 && primeiro.fromIcao === ultimo.toIcao) {
    return `${origem} ↔ ${destinoIda}`;
  }
  return `${origem} → ${destinoFim}`;
}

function lerArquivoComoDataUrl(file: File): Promise<{ nome: string; url: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      if (!url) {
        reject(new Error("Não foi possível ler o comprovante."));
        return;
      }
      resolve({ nome: file.name, url });
    };
    reader.onerror = () => reject(new Error("Falha ao ler o comprovante."));
    reader.readAsDataURL(file);
  });
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
  const [aircraftId, setAircraftId] = useState<string>(atual?.aircraftId ?? base.aircraft[0]?.id ?? "");
  const [purpose, setPurpose] = useState<Purpose>(atual?.purpose ?? "negocios");
  const [requestedBy, setRequestedBy] = useState<string>(atual?.requestedBy ?? base.partners[0]?.id ?? "");
  const [status, setStatus] = useState<ItineraryStatus>(atual?.status ?? "previsto");
  const [passengers, setPassengers] = useState<string>(atual?.passengers.join(", ") ?? "");
  const [note, setNote] = useState<string>(atual?.note ?? "");
  const [conditional, setConditional] = useState<string>(atual?.conditional ?? "");
  const [abastecimentoValor, setAbastecimentoValor] = useState<string>(
    atual?.abastecimento ? String(atual.abastecimento.valor) : "",
  );
  const [abastecimentoLitros, setAbastecimentoLitros] = useState<string>(
    atual?.abastecimento ? String(atual.abastecimento.litros) : "",
  );
  const [anexoNome, setAnexoNome] = useState<string>(atual?.abastecimento?.anexoNome ?? "");
  const [anexoUrl, setAnexoUrl] = useState<string>(atual?.abastecimento?.anexoUrl ?? "");
  const [legs, setLegs] = useState<PernaCampo[]>(
    atual && atual.legs.length > 0 ? atual.legs.map(pernaDe) : [pernaVazia()],
  );

  const avisoEscala = useMemo(() => {
    if (!aircraftId || !requestedBy) return null;
    const cruzamentos = new Map<string, string>();
    for (const perna of legs) {
      const iso = perna.date.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
      const posse = posseDoDia(iso, aircraftId);
      if (posse && posse !== requestedBy) {
        cruzamentos.set(posse, partnerShort(posse));
      }
    }
    if (cruzamentos.size === 0) return null;
    const nomes = [...cruzamentos.values()];
    if (nomes.length === 1) {
      return `Este voo está no período de ${nomes[0]} na agenda. O custo continua com quem pediu.`;
    }
    return `Este voo cruza períodos de ${nomes.join(", ")} na agenda. O custo continua com quem pediu.`;
  }, [aircraftId, requestedBy, legs]);

  const previewTanque = useMemo(() => {
    const valor = numeroCampo(abastecimentoValor || "0");
    const litros = numeroCampo(abastecimentoLitros || "0");
    const preco = precoPorLitroAbastecimento({ valor, litros });
    if (preco === null) return null;
    const horas = legs.reduce((soma, perna) => {
      const h = numeroCampo(perna.blockHours);
      return soma + (Number.isNaN(h) ? 0 : h);
    }, 0);
    const litrosVoo = litrosConsumidosTrecho(aircraftId, horas);
    return {
      preco,
      litrosNf: litros,
      litrosVoo,
      gph: consumoMedioGph(aircraftId),
      valor,
    };
  }, [abastecimentoValor, abastecimentoLitros, legs, aircraftId]);

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

  async function onAnexo(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    try {
      const lido = await lerArquivoComoDataUrl(file);
      setAnexoNome(lido.nome);
      setAnexoUrl(lido.url);
      setErro("");
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Falha ao anexar o comprovante.");
    }
  }

  function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!aircraftId || !requestedBy) {
      setErro("Informe a aeronave e quem pediu o voo.");
      return;
    }
    if (legs.length === 0) {
      setErro("Inclua ao menos uma perna.");
      return;
    }

    let abastecimento: AbastecimentoVoo | undefined;
    const temValor = abastecimentoValor.trim() !== "";
    const temLitros = abastecimentoLitros.trim() !== "";
    if (temValor || temLitros || anexoUrl) {
      const valor = numeroCampo(abastecimentoValor || "0");
      const litros = numeroCampo(abastecimentoLitros || "0");
      if (Number.isNaN(valor) || Number.isNaN(litros) || valor <= 0 || litros <= 0) {
        setErro("Informe valor total e quantidade em litros do abastecimento.");
        return;
      }
      abastecimento = {
        valor,
        litros,
        anexoNome: anexoNome || undefined,
        anexoUrl: anexoUrl || undefined,
      };
    }

    const crew = tripulacao(aircraftId, base.crew);
    const montadas: Leg[] = [];
    for (const perna of legs) {
      const horas = numeroCampo(perna.blockHours || "0");
      const valores = [perna.fees, perna.handling, perna.catering].map(numeroCampo);
      if (!perna.fromIcao.trim() || !perna.toIcao.trim()) {
        setErro("Informe origem e destino de cada perna.");
        return;
      }
      if (!perna.date || Number.isNaN(horas) || horas <= 0 || valores.some((item) => Number.isNaN(item))) {
        setErro("Revise data, horas e valores de cada perna.");
        return;
      }
      const posting =
        perna.posting === "realizado" || perna.posting === "previsto" || perna.posting === "provisionado"
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
        fuel: 0,
        fees: valores[0] ?? 0,
        handling: valores[1] ?? 0,
        catering: valores[2] ?? 0,
        commanderId: crew.commanderId,
        copilotId: crew.copilotId,
        posting,
      });
    }
    const itineraryId = atual?.id ?? criarId("voo");
    salvarItinerario({
      id: itineraryId,
      aircraftId,
      title: tituloDoVoo(montadas),
      purpose,
      requestedBy,
      passengers: passengers
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      status,
      note: note.trim() || "Lançado na operação.",
      conditional: conditional.trim() || undefined,
      abastecimento,
      legs: montadas,
    });
    router.push(`/itinerarios/${itineraryId}`);
  }

  return (
    <FormPage
      voltarHref={atual ? `/itinerarios/${atual.id}` : "/itinerarios"}
      voltar="Voltar aos itinerários"
      titulo={atual ? "Editar voo" : "Novo voo"}
    >
      <form onSubmit={salvar}>
        <Grade>
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
        {avisoEscala ? (
          <p className="mt-4 rounded-xl border border-[#F3E6D8] bg-[#FBF6F0] px-3 py-2.5 text-[13px] text-[#8B5E3C]">
            {avisoEscala}
          </p>
        ) : null}

        <h3 className="mt-5 text-[14px] font-bold">Abastecimento</h3>
        <p className="mt-1 text-[12px] text-tse-muted">
          Opcional. O valor total da NF vai para Despesas da operação. Os litros entram no tanque da
          aeronave; voos realizados fecham essa conta pelo consumo (horas × gal/h) e rateiam o valor
          aos solicitantes.
        </p>
        <div className="mt-2">
          <Grade>
            <Campo
              label="Valor total (R$)"
              value={abastecimentoValor}
              onChange={setAbastecimentoValor}
              type="number"
              step="0.01"
              inputMode="decimal"
            />
            <Campo
              label="Quantidade (L)"
              value={abastecimentoLitros}
              onChange={setAbastecimentoLitros}
              type="number"
              step="0.01"
              inputMode="decimal"
            />
          </Grade>
          <label className="mt-3 block">
            <span className="mb-1 block text-[11px] font-bold tracking-wide text-tse-muted uppercase">
              Comprovante
            </span>
            <input
              type="file"
              accept="image/*,.pdf,application/pdf"
              onChange={(event) => void onAnexo(event.target.files)}
              className="block w-full text-[13px] text-tse-muted file:mr-3 file:rounded-md file:border-0 file:bg-[#E8E8E8] file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-tse-text hover:file:bg-[#DDDDDD]"
            />
          </label>
          {anexoUrl ? (
            <p className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
              <a
                href={anexoUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-tse-olive underline-offset-2 hover:underline"
              >
                {anexoNome || "Ver comprovante"}
              </a>
              <button
                type="button"
                onClick={() => {
                  setAnexoNome("");
                  setAnexoUrl("");
                }}
                className="font-bold text-[#EF4444]"
              >
                Remover anexo
              </button>
            </p>
          ) : null}
          {previewTanque ? (
            <p className="mt-3 rounded-xl bg-tse-bg px-3 py-2.5 text-[13px] text-tse-muted">
              NF {formatBRL(previewTanque.valor)} · {previewTanque.litrosNf.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L
              ({formatBRL(previewTanque.preco)}/L) entram no tanque. Este voo, se realizado, consome
              cerca de {previewTanque.litrosVoo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L
              ({previewTanque.gph} gal/h) e assume essa fatia no rateio.
            </p>
          ) : null}
        </div>

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
                <Campo
                  label="Data"
                  value={perna.date}
                  onChange={(value) => atualizarPerna(perna.id, { date: value })}
                  type="date"
                />
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
                <CampoAerodromo
                  label="Origem"
                  icao={perna.fromIcao}
                  cidade={perna.fromCity}
                  placeholder="ex.: SBTE ou Teresina"
                  onChange={(icao, cidade) =>
                    atualizarPerna(perna.id, {
                      fromIcao: icao,
                      fromCity: cidade || cidadeAerodromo(icao),
                    })
                  }
                />
                <CampoAerodromo
                  label="Destino"
                  icao={perna.toIcao}
                  cidade={perna.toCity}
                  placeholder="ex.: SBFZ ou Fortaleza"
                  onChange={(icao, cidade) =>
                    atualizarPerna(perna.id, {
                      toIcao: icao,
                      toCity: cidade || cidadeAerodromo(icao),
                    })
                  }
                />
                <Campo
                  label="Decolagem"
                  value={perna.depart}
                  onChange={(value) => atualizarPerna(perna.id, { depart: value })}
                />
                <Campo
                  label="Pouso"
                  value={perna.arrive}
                  onChange={(value) => atualizarPerna(perna.id, { arrive: value })}
                />
                <Campo
                  label="Horas de bloco"
                  value={perna.blockHours}
                  onChange={(value) => atualizarPerna(perna.id, { blockHours: value })}
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                />
                <Campo
                  label="Taxas (R$)"
                  value={perna.fees}
                  onChange={(value) => atualizarPerna(perna.id, { fees: value })}
                  type="number"
                />
                <Campo
                  label="Handling (R$)"
                  value={perna.handling}
                  onChange={(value) => atualizarPerna(perna.id, { handling: value })}
                  type="number"
                />
                <Campo
                  label="Catering (R$)"
                  value={perna.catering}
                  onChange={(value) => atualizarPerna(perna.id, { catering: value })}
                  type="number"
                />
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
          Taxas, handling e catering entram no rateio de quem pediu. Combustível: NF na operação;
          fatia do tanque por litros consumidos nos voos realizados.
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
