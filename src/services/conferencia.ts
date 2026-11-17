import { ABASTECIMENTOS_VIBRA, FATURAMENTO_VIBRA, NOTAS_FISCAIS } from "@/data/caso-real";
import { validarOrigemAbastecimentoVibra } from "@/services/alocacoes-vibra";
import { getBase } from "@/services/dados";
import {
  aerodromoLabel,
  allocationDoVoo,
  alocarTanqueCombustivel,
  getAircraft,
  getItinerary,
  legPosting,
  listExpenses,
  litrosConsumidosTrecho,
  matchesAircraft,
  matchesMonth,
  partnerShort,
  type MonthFilter,
} from "@/services/operacao";
import type { Itinerary, Leg, NotaFiscal } from "@/types/operacao";

export type ConferenciaSolicitante = {
  partnerId: string;
  combustivel: number;
  taxas: number;
  litros: number;
  trechos: number;
};

export type ConferenciaNotaFatia = {
  notaId: string;
  numero: string;
  fornecedor: string;
  date: string;
  valorNf: number;
  amount: number;
  litros?: number;
  anexoUrl?: string;
  anexoNome?: string;
};

/** Uma linha = um trecho (perna), nunca o circuito inteiro. */
export type ConferenciaLinha = {
  key: string;
  itineraryId: string;
  legId: string;
  date: string;
  month: string;
  aircraftId: string;
  partnerId: string;
  /** Despesa do trecho rateada por participação (ex.: traslado de compra). */
  rateioParticipacao: boolean;
  route: string;
  blockHours: number;
  litros: number;
  combCalculo: number;
  /** true = combustível coberto por NF Vibra (realizado / FIFO). */
  combNaNf: boolean;
  combNotas: ConferenciaNotaFatia[];
  taxasCalculo: number;
  taxasNotas: ConferenciaNotaFatia[];
};

export type ConferenciaLadoNotas = {
  quantidade: number;
  valor: number;
  litros: number | null;
  distribuido: number;
  litrosDistribuidos: number;
  saldo: number;
};

export type ConferenciaPrestacao = {
  combustivel: ConferenciaLadoNotas;
  taxas: ConferenciaLadoNotas;
  totalNotas: number;
  totalDistribuido: number;
  linhas: ConferenciaLinha[];
  porSolicitante: ConferenciaSolicitante[];
  trechosSemNf: number;
};

type Demanda = {
  trip: Itinerary;
  leg: Leg;
  amountRestante: number;
  litrosTotais: number;
};

type FatiaComb = {
  itineraryId: string;
  legId: string;
  date: string;
  partnerId: string;
  aircraftId: string;
  blockHours: number;
  litros: number;
  amount: number;
  nota: ConferenciaNotaFatia;
};

function centavos(value: number): number {
  return Math.round(value * 100) / 100;
}

function notaPorNumero(numero: string | undefined): NotaFiscal | undefined {
  if (!numero) return undefined;
  const limpo = numero.replace(/^0+/, "");
  return NOTAS_FISCAIS.find(
    (item) => item.numero === numero || item.numero.replace(/^0+/, "") === limpo,
  );
}

function docDaDescricao(description: string): string | undefined {
  return description.match(/doc\s+(\d+)/i)?.[1];
}

function postingConsomeCombustivel(leg: Leg, trip: Itinerary): boolean {
  const posting = legPosting(leg, trip);
  return posting === "realizado" || posting === "provisionado";
}

function demandasCombustivel(aircraftId: string): Demanda[] {
  const demandas: Demanda[] = [];
  for (const trip of getBase().itineraries) {
    if (trip.status === "cancelado") continue;
    if (!matchesAircraft(trip.aircraftId, aircraftId)) continue;
    for (const leg of trip.legs) {
      if (!postingConsomeCombustivel(leg, trip)) continue;
      const amount = leg.fuel > 0 ? leg.fuel : 0;
      const litros = litrosConsumidosTrecho(trip.aircraftId, leg.blockHours);
      if (amount <= 0 && litros <= 0) continue;
      demandas.push({ trip, leg, amountRestante: amount, litrosTotais: litros });
    }
  }
  return demandas.sort(
    (left, right) =>
      left.leg.date.localeCompare(right.leg.date) ||
      left.leg.depart.localeCompare(right.leg.depart) ||
      left.leg.id.localeCompare(right.leg.id),
  );
}

function alocarCombustivelPorNotas(aircraftId: string): {
  fatias: FatiaComb[];
  trechosSemNf: number;
} {
  const notas = NOTAS_FISCAIS.filter(
    (item) => item.origem === "vibra" && matchesAircraft(item.aircraftId, aircraftId),
  ).sort(
    (left, right) =>
      left.date.localeCompare(right.date) || left.numero.localeCompare(right.numero),
  );
  const demandas = demandasCombustivel(aircraftId);
  const totalLitros = demandas.reduce((soma, item) => soma + item.litrosTotais, 0);
  const totalNotas = notas.reduce((soma, item) => soma + item.amount, 0);
  // Sem fuel na perna: define a demanda em R$ pelo rateio dos litros estimados.
  if (totalLitros > 0 && totalNotas > 0) {
    let alocado = 0;
    const semValor = demandas.filter((item) => item.amountRestante <= 0.009 && item.litrosTotais > 0);
    for (let i = 0; i < semValor.length; i += 1) {
      const demanda = semValor[i];
      if (!demanda) continue;
      const valor =
        i === semValor.length - 1
          ? centavos(totalNotas - alocado)
          : centavos((demanda.litrosTotais / totalLitros) * totalNotas);
      demanda.amountRestante = Math.max(0, valor);
      alocado = centavos(alocado + demanda.amountRestante);
    }
  }
  let indice = 0;
  const fatias: FatiaComb[] = [];
  const valorBasePorLeg = new Map(
    demandas.map((item) => [
      item.leg.id,
      item.leg.fuel > 0
        ? item.leg.fuel
        : totalLitros > 0
          ? centavos((item.litrosTotais / totalLitros) * totalNotas)
          : 0,
    ]),
  );

  for (const nota of notas) {
    let rest = centavos(nota.amount);
    while (rest > 0.009 && indice < demandas.length) {
      const demanda = demandas[indice];
      if (!demanda) break;
      if (demanda.amountRestante <= 0.009) {
        indice += 1;
        continue;
      }
      const take = Math.min(rest, demanda.amountRestante);
      const baseFuel = valorBasePorLeg.get(demanda.leg.id) || take;
      const fracao = baseFuel > 0 ? take / baseFuel : 1;
      fatias.push({
        itineraryId: demanda.trip.id,
        legId: demanda.leg.id,
        date: demanda.leg.date,
        partnerId: demanda.trip.requestedBy,
        aircraftId: demanda.trip.aircraftId,
        blockHours: demanda.leg.blockHours * fracao,
        litros: demanda.litrosTotais * fracao,
        amount: centavos(take),
        nota: {
          notaId: nota.id,
          numero: nota.numero,
          fornecedor: nota.fornecedor,
          date: nota.date,
          valorNf: nota.amount,
          amount: centavos(take),
          litros: demanda.litrosTotais * fracao,
          anexoUrl: nota.anexoUrl,
          anexoNome: nota.anexoNome,
        },
      });
      demanda.amountRestante = centavos(demanda.amountRestante - take);
      rest = centavos(rest - take);
      if (demanda.amountRestante <= 0.009) indice += 1;
    }
  }

  return {
    fatias,
    trechosSemNf: demandas.filter((item) => item.amountRestante > 0.009).length,
  };
}

function alocarCombustivelPorTanque(aircraftId: string): {
  fatias: FatiaComb[];
  trechosSemNf: number;
} {
  const fatiasTanque = alocarTanqueCombustivel(aircraftId === "todas" ? undefined : aircraftId);
  const notas = NOTAS_FISCAIS.filter(
    (item) => item.origem === "vibra" && matchesAircraft(item.aircraftId, aircraftId),
  );
  const notaPorId = new Map(notas.map((item) => [item.id, item]));
  const trips = new Map(
    getBase()
      .itineraries.filter((trip) => matchesAircraft(trip.aircraftId, aircraftId))
      .map((trip) => [trip.id, trip]),
  );
  const blockPorLeg = new Map<string, number>();
  for (const trip of trips.values()) {
    for (const leg of trip.legs) {
      blockPorLeg.set(leg.id, leg.blockHours);
    }
  }
  const fatias: FatiaComb[] = [];
  for (const fatia of fatiasTanque) {
    if (!matchesAircraft(fatia.aircraftId, aircraftId)) continue;
    const abastTrip = trips.get(fatia.abastecimentoId);
    const abast = abastTrip?.abastecimento;
    const nota =
      notaPorId.get(fatia.abastecimentoId) ??
      (abast
        ? (notas.find(
            (item) =>
              item.aircraftId === fatia.aircraftId &&
              Math.abs(item.amount - abast.valor) < 0.02 &&
              Math.abs(Date.parse(item.date) - Date.parse(abastTrip.legs[0]?.date ?? item.date)) <
                1000 * 60 * 60 * 24 * 14,
          ) ??
          notas.find(
            (item) =>
              item.aircraftId === fatia.aircraftId && Math.abs(item.amount - abast.valor) < 0.02,
          ))
        : undefined);
    fatias.push({
      itineraryId: fatia.itineraryId,
      legId: fatia.legId,
      date: fatia.date,
      partnerId: fatia.partnerId,
      aircraftId: fatia.aircraftId,
      blockHours: blockPorLeg.get(fatia.legId) ?? 0,
      litros: fatia.litros,
      amount: fatia.amount,
      nota: {
        notaId: nota?.id ?? fatia.abastecimentoId,
        numero: nota?.numero ?? fatia.abastecimentoId.replace(/^voo-/, "").toUpperCase(),
        fornecedor: nota?.fornecedor ?? "Abastecimento",
        date: nota?.date ?? abastTrip?.legs[0]?.date ?? fatia.date,
        valorNf: nota?.amount ?? abast?.valor ?? fatia.amount,
        amount: fatia.amount,
        litros: fatia.litros,
        anexoUrl: nota?.anexoUrl,
        anexoNome: nota?.anexoNome,
      },
    });
  }
  return { fatias, trechosSemNf: 0 };
}

function temLoteCombustivel(aircraftId: string): boolean {
  const temAbastecimentoVoo = getBase().itineraries.some(
    (trip) =>
      matchesAircraft(trip.aircraftId, aircraftId) &&
      trip.abastecimento &&
      trip.abastecimento.valor > 0 &&
      trip.abastecimento.litros > 0,
  );
  if (temAbastecimentoVoo) return true;
  return NOTAS_FISCAIS.some(
    (item) =>
      item.origem === "vibra" &&
      item.amount > 0 &&
      matchesAircraft(item.aircraftId, aircraftId),
  );
}

function agregarNotas(fatias: ConferenciaNotaFatia[]): ConferenciaNotaFatia[] {
  const mapa = new Map<string, ConferenciaNotaFatia>();
  for (const item of fatias) {
    const atual = mapa.get(item.notaId) ?? {
      ...item,
      amount: 0,
      litros: 0,
    };
    atual.amount = centavos(atual.amount + item.amount);
    atual.litros = (atual.litros ?? 0) + (item.litros ?? 0);
    mapa.set(item.notaId, atual);
  }
  return [...mapa.values()].sort(
    (left, right) => left.date.localeCompare(right.date) || left.numero.localeCompare(right.numero),
  );
}

function rotaTrecho(leg: Leg): string {
  return `${aerodromoLabel(leg.fromCity, leg.fromIcao)} → ${aerodromoLabel(leg.toCity, leg.toIcao)}`;
}

type TaxaTrecho = {
  itineraryId: string;
  legId: string;
  amount: number;
  notas: ConferenciaNotaFatia[];
  partnerId: string;
  date: string;
  aircraftId: string;
  route: string;
  blockHours: number;
};

function taxasPorTrecho(aircraftId: string): Map<string, TaxaTrecho> {
  const mapa = new Map<string, TaxaTrecho>();

  for (const expense of listExpenses()) {
    if (expense.category !== "taxas") continue;
    if (!matchesAircraft(expense.aircraftId, aircraftId)) continue;
    if (expense.posting !== "realizado" && expense.posting !== "provisionado") continue;
    if (!(expense.amount > 0)) continue;
    if (!expense.itineraryId || !expense.legId) continue;

    const trip = getItinerary(expense.itineraryId);
    if (!trip || trip.status === "cancelado") continue;
    const leg = trip.legs.find((item) => item.id === expense.legId);
    if (!leg) continue;

    const doc = docDaDescricao(expense.description);
    const nota = notaPorNumero(doc);
    const fatia: ConferenciaNotaFatia = {
      notaId: nota?.id ?? `taxa-doc-${doc ?? expense.id}`,
      numero: nota?.numero ?? doc ?? "—",
      fornecedor: nota?.fornecedor ?? expense.vendor,
      date: nota?.date ?? expense.date,
      valorNf: nota?.amount ?? expense.amount,
      amount: expense.amount,
      anexoUrl: nota?.anexoUrl,
      anexoNome: nota?.anexoNome,
    };

    const chave = `${expense.itineraryId}:${expense.legId}`;
    const atual = mapa.get(chave) ?? {
      itineraryId: expense.itineraryId,
      legId: expense.legId,
      amount: 0,
      notas: [],
      partnerId: expense.partnerId ?? trip.requestedBy,
      date: leg.date,
      aircraftId: trip.aircraftId,
      route: rotaTrecho(leg),
      blockHours: leg.blockHours,
    };
    atual.amount = centavos(atual.amount + expense.amount);
    atual.notas.push(fatia);
    mapa.set(chave, atual);
  }

  for (const [chave, item] of mapa) {
    item.notas = agregarNotas(item.notas);
    mapa.set(chave, item);
  }
  return mapa;
}

function montarLinhas(
  aircraftId: string,
  fatiasComb: FatiaComb[],
  taxasMap: Map<string, TaxaTrecho>,
): ConferenciaLinha[] {
  const porTrecho = new Map<string, FatiaComb[]>();
  for (const fatia of fatiasComb) {
    const chave = `${fatia.itineraryId}:${fatia.legId}`;
    const lista = porTrecho.get(chave) ?? [];
    lista.push(fatia);
    porTrecho.set(chave, lista);
  }

  const linhas: ConferenciaLinha[] = [];

  // Uma linha por trecho realizado/provisionado — com ou sem taxa/NF.
  for (const trip of getBase().itineraries) {
    if (trip.status === "cancelado") continue;
    if (!matchesAircraft(trip.aircraftId, aircraftId)) continue;
    for (const leg of trip.legs) {
      if (!postingConsomeCombustivel(leg, trip)) continue;
      const chave = `${trip.id}:${leg.id}`;
      const comb = porTrecho.get(chave) ?? [];
      const taxa = taxasMap.get(chave);
      const combFaturado = centavos(comb.reduce((soma, item) => soma + item.amount, 0));
      const litrosFaturado = comb.reduce((soma, item) => soma + item.litros, 0);
      const litrosEstimados = litrosConsumidosTrecho(trip.aircraftId, leg.blockHours);
      const combLegado =
        combFaturado <= 0 && leg.fuel > 0
          ? { amount: centavos(leg.fuel), litros: litrosEstimados }
          : null;
      const rateioParticipacao = allocationDoVoo(trip) === "participacao";

      linhas.push({
        key: chave,
        itineraryId: trip.id,
        legId: leg.id,
        date: leg.date,
        month: leg.date.slice(0, 7),
        aircraftId: trip.aircraftId,
        partnerId: comb[0]?.partnerId ?? taxa?.partnerId ?? trip.requestedBy,
        rateioParticipacao,
        route: rotaTrecho(leg),
        blockHours: leg.blockHours,
        litros: litrosFaturado > 0 ? litrosFaturado : litrosEstimados,
        combCalculo: combFaturado > 0 ? combFaturado : (combLegado?.amount ?? 0),
        combNaNf: combFaturado > 0,
        combNotas: agregarNotas(comb.map((item) => item.nota)),
        taxasCalculo: taxa?.amount ?? 0,
        taxasNotas: taxa?.notas ?? [],
      });
    }
  }

  return linhas.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.legId.localeCompare(right.legId) ||
      left.itineraryId.localeCompare(right.itineraryId),
  );
}

function agregarSolicitantes(linhas: ConferenciaLinha[]): ConferenciaSolicitante[] {
  const mapa = new Map<string, ConferenciaSolicitante>();
  const garantir = (partnerId: string) => {
    const atual = mapa.get(partnerId) ?? {
      partnerId,
      combustivel: 0,
      taxas: 0,
      litros: 0,
      trechos: 0,
    };
    mapa.set(partnerId, atual);
    return atual;
  };

  for (const linha of linhas) {
    const comb = linha.combNaNf ? linha.combCalculo : 0;
    if (linha.rateioParticipacao) {
      const ownership = getAircraft(linha.aircraftId)?.ownership ?? [];
      if (ownership.length === 0) {
        const atual = garantir(linha.partnerId);
        atual.combustivel = centavos(atual.combustivel + comb);
        atual.taxas = centavos(atual.taxas + linha.taxasCalculo);
        atual.litros += linha.litros;
        atual.trechos += 1;
        continue;
      }
      for (const owner of ownership) {
        const atual = garantir(owner.partnerId);
        atual.combustivel = centavos(atual.combustivel + comb * owner.share);
        atual.taxas = centavos(atual.taxas + linha.taxasCalculo * owner.share);
        atual.litros += linha.litros * owner.share;
        atual.trechos += 1;
      }
      continue;
    }
    const atual = garantir(linha.partnerId);
    atual.combustivel = centavos(atual.combustivel + comb);
    atual.taxas = centavos(atual.taxas + linha.taxasCalculo);
    atual.litros += linha.litros;
    atual.trechos += 1;
  }
  return [...mapa.values()].sort(
    (left, right) =>
      right.combustivel + right.taxas - (left.combustivel + left.taxas) ||
      partnerShort(left.partnerId).localeCompare(partnerShort(right.partnerId)),
  );
}

function ladoNotas(params: {
  notas: NotaFiscal[];
  distribuido: number;
  litrosDistribuidos: number;
}): ConferenciaLadoNotas {
  const valor = centavos(params.notas.reduce((soma, item) => soma + item.amount, 0));
  return {
    quantidade: params.notas.length,
    valor,
    litros: null,
    distribuido: params.distribuido,
    litrosDistribuidos: params.litrosDistribuidos,
    saldo: Math.max(0, centavos(valor - params.distribuido)),
  };
}

/**
 * Prestação de contas: trecho a trecho × combustível (FIFO) × taxas de pouso.
 */
export function conferenciaPrestacao(
  months: MonthFilter,
  aircraftId: string,
  partnerId?: string | null,
): ConferenciaPrestacao {
  const comb = temLoteCombustivel(aircraftId)
    ? alocarCombustivelPorTanque(aircraftId)
    : alocarCombustivelPorNotas(aircraftId);
  const taxasMap = taxasPorTrecho(aircraftId);

  let linhas = montarLinhas(aircraftId, comb.fatias, taxasMap).filter((linha) =>
    matchesMonth(linha.month, months),
  );
  if (partnerId) {
    const sharePorAeronave = new Map<string, number>();
    linhas = linhas.flatMap((linha) => {
      if (!linha.rateioParticipacao) {
        return linha.partnerId === partnerId ? [linha] : [];
      }
      let share = sharePorAeronave.get(linha.aircraftId);
      if (share == null) {
        share =
          getAircraft(linha.aircraftId)?.ownership.find((item) => item.partnerId === partnerId)
            ?.share ?? 0;
        sharePorAeronave.set(linha.aircraftId, share);
      }
      if (!(share > 0)) return [];
      return [
        {
          ...linha,
          key: `${linha.key}:${partnerId}`,
          partnerId,
          litros: linha.litros * share,
          combCalculo: centavos(linha.combCalculo * share),
          taxasCalculo: centavos(linha.taxasCalculo * share),
        },
      ];
    });
  }

  // Só o combustível coberto por NF entra no fechamento da conferência.
  const combustivelDistribuido = centavos(
    linhas.reduce((soma, linha) => soma + (linha.combNaNf ? linha.combCalculo : 0), 0),
  );
  const taxasDistribuidas = centavos(linhas.reduce((soma, linha) => soma + linha.taxasCalculo, 0));
  const litrosDistribuidos = linhas.reduce(
    (soma, linha) => soma + (linha.combNaNf ? linha.litros : 0),
    0,
  );

  const idsComb = new Set(linhas.flatMap((linha) => linha.combNotas.map((n) => n.notaId)));
  const idsTaxa = new Set(linhas.flatMap((linha) => linha.taxasNotas.map((n) => n.notaId)));

  const notasComb = NOTAS_FISCAIS.filter(
    (item) =>
      item.origem === "vibra" &&
      matchesAircraft(item.aircraftId, aircraftId) &&
      (idsComb.size === 0 || idsComb.has(item.id)) &&
      matchesMonth(item.month, months),
  );
  // Se o filtro de mês da NF excluir notas usadas em trechos do mês (FIFO cruza meses),
  // usa as NFs efetivamente referenciadas nas linhas.
  const notasCombEfetivas =
    notasComb.length > 0
      ? notasComb
      : NOTAS_FISCAIS.filter((item) => idsComb.has(item.id));

  const notasTaxa = NOTAS_FISCAIS.filter(
    (item) =>
      item.origem === "tarifa-pouso" &&
      matchesAircraft(item.aircraftId, aircraftId) &&
      (idsTaxa.size === 0 || idsTaxa.has(item.id)) &&
      matchesMonth(item.month, months),
  );
  const notasTaxaEfetivas =
    notasTaxa.length > 0
      ? notasTaxa
      : NOTAS_FISCAIS.filter((item) => idsTaxa.has(item.id));

  // Para fechar a conferência no período dos trechos: total das NFs tocadas × distribuído.
  const combLado = ladoNotas({
    notas:
      idsComb.size > 0
        ? NOTAS_FISCAIS.filter((item) => idsComb.has(item.id))
        : notasCombEfetivas,
    distribuido: combustivelDistribuido,
    litrosDistribuidos,
  });
  const taxasLado = ladoNotas({
    notas:
      idsTaxa.size > 0
        ? NOTAS_FISCAIS.filter((item) => idsTaxa.has(item.id))
        : notasTaxaEfetivas,
    distribuido: taxasDistribuidas,
    litrosDistribuidos: 0,
  });

  return {
    combustivel: combLado,
    taxas: taxasLado,
    totalNotas: centavos(combLado.valor + taxasLado.valor),
    totalDistribuido: centavos(combLado.distribuido + taxasLado.distribuido),
    linhas,
    porSolicitante: agregarSolicitantes(linhas),
    trechosSemNf: partnerId ? 0 : comb.trechosSemNf,
  };
}

export function tituloVooConferencia(itineraryId: string): string {
  const trip = getItinerary(itineraryId);
  return trip?.title ?? itineraryId;
}

export type ConferenciaVibraTrecho = {
  itineraryId: string;
  legId: string;
  route: string;
  date: string;
  blockHours: number;
  litros: number;
  partnerId: string;
  rateioParticipacao: boolean;
  /** Trecho em dia diferente do abastecimento (janela vizinha). */
  diaVizinho: boolean;
  /** Diferença em dias vs data do abastecimento (negativo = antes). */
  deltaDias: number;
  /**
   * Elo intermediário: não passa pelo aeroporto do abastecimento,
   * mas fecha a sequência entre trechos que passam (ex.: SBTE→SJ4Z … SJ4Z→SNPC … SNPC→SBTE).
   */
  eloFora: boolean;
};

export type ConferenciaVibraStatus = "ok" | "sem_voo" | "atencao" | "vizinho" | "sem_abast";

export type ConferenciaVibraMatchTipo = "mesmo_dia" | "vizinho" | "elo" | "sem_abast";

/**
 * Uma linha = um trecho do relatório de voos (ordem original).
 * Colunas de abastecimento vêm do match (podem repetir o mesmo comprovante no grupo).
 */
export type ConferenciaVibraLinha = {
  key: string;
  itineraryId: string;
  legId: string;
  /** Sequência operacional (arquivo importado / encadeamento pela base). */
  ordem: number;
  date: string;
  month: string;
  aircraftId: string;
  partnerId: string;
  rateioParticipacao: boolean;
  route: string;
  fromIcao: string;
  toIcao: string;
  blockHours: number;
  litrosCalc: number;
  abastecimentoId: string | null;
  referencia: string | null;
  abastDate: string | null;
  icao: string | null;
  cidade: string | null;
  /** Litros/valor do comprovante (repetidos em todos os trechos do grupo). */
  litrosAbast: number | null;
  amount: number | null;
  notaNumero: string | null;
  notaDate: string | null;
  anexoUrl?: string;
  precoLitro: number | null;
  matchTipo: ConferenciaVibraMatchTipo;
  deltaDias: number;
  primeiroDoGrupo: boolean;
  grupoTrechos: number;
  litrosGrupoCalc: number;
  deltaLitrosGrupo: number | null;
  /** Litros que ainda restam na NF após consumir este trecho (saldo cumulativo). */
  saldoAposTrecho: number | null;
  status: ConferenciaVibraStatus;
  detalhe: string;
};

/** Comprovante Vibra sem trecho casado. */
export type ConferenciaVibraOrfa = {
  key: string;
  abastecimentoId: string;
  referencia: string;
  date: string;
  icao: string;
  cidade: string | null;
  litros: number;
  amount: number | null;
  notaNumero: string | null;
  notaDate: string | null;
  anexoUrl?: string;
  precoLitro: number | null;
  detalhe: string;
};

export type ConferenciaVibraNotaOrfa = {
  numero: string;
  date: string;
  amount: number;
  referencia: string | null;
};

/** Totais Vibra por sócio (valor da NF rateado pelos trechos ligados). */
export type ConferenciaVibraSolicitante = {
  partnerId: string;
  combustivel: number;
  litros: number;
  trechos: number;
  abastecimentos: number;
};

export type ConferenciaVibraPorData = {
  /** Trechos na ordem dos voos importados. */
  linhas: ConferenciaVibraLinha[];
  /** Abastecimentos sem trecho casado. */
  orfaos: ConferenciaVibraOrfa[];
  totalAbastecimentos: number;
  totalValor: number;
  totalLitros: number;
  comVoo: number;
  semVoo: number;
  atencao: number;
  semAbast: number;
  precoLitroMediano: number | null;
  /** Total das NFs Vibra do período (faturamento). */
  totalFaturadoPeriodo: number;
  /** NFs Vibra do período sem comprovante individual. */
  notasSemComprovante: ConferenciaVibraNotaOrfa[];
  /** Rateio do valor dos comprovantes por sócio dos trechos. */
  porSolicitante: ConferenciaVibraSolicitante[];
};

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  const a = ordenados[meio];
  if (a == null) return null;
  if (ordenados.length % 2 === 1) return a;
  const b = ordenados[meio - 1];
  if (b == null) return a;
  return (a + b) / 2;
}

type GrupoAbastMatch = {
  abastecimentoId: string;
  referencia: string;
  abastDate: string;
  icao: string;
  cidade: string | null;
  litros: number;
  amount: number | null;
  notaNumero: string | null;
  notaDate: string | null;
  anexoUrl?: string;
  precoLitro: number | null;
  trechosVizinhos: boolean;
  trechos: ConferenciaVibraTrecho[];
  litrosCalc: number;
  deltaLitros: number | null;
  status: ConferenciaVibraStatus;
  detalhe: string;
};

/** Rateia o valor de cada comprovante pelos trechos ligados (peso = litros). */
function agregarSolicitantesVibra(
  grupos: GrupoAbastMatch[],
  aircraftIdFallback: string,
): ConferenciaVibraSolicitante[] {
  const mapa = new Map<
    string,
    ConferenciaVibraSolicitante & { abasts: Set<string> }
  >();
  const garantir = (partnerId: string) => {
    const atual = mapa.get(partnerId) ?? {
      partnerId,
      combustivel: 0,
      litros: 0,
      trechos: 0,
      abastecimentos: 0,
      abasts: new Set<string>(),
    };
    mapa.set(partnerId, atual);
    return atual;
  };

  const creditar = (
    partnerId: string,
    combustivel: number,
    litros: number,
    abastecimentoId: string,
  ) => {
    const atual = garantir(partnerId);
    atual.combustivel = centavos(atual.combustivel + combustivel);
    atual.litros += litros;
    atual.trechos += 1;
    atual.abasts.add(abastecimentoId);
  };

  for (const grupo of grupos) {
    if (grupo.trechos.length === 0) continue;
    const amount = grupo.amount ?? 0;
    const somaLitrosTrechos = grupo.trechos.reduce((soma, item) => soma + item.litros, 0);

    for (const trecho of grupo.trechos) {
      const trip = getItinerary(trecho.itineraryId);
      const aircraftId = trip?.aircraftId ?? aircraftIdFallback;
      const peso =
        somaLitrosTrechos > 0
          ? trecho.litros / somaLitrosTrechos
          : 1 / grupo.trechos.length;
      const valorTrecho = amount * peso;
      const litrosTrecho =
        somaLitrosTrechos > 0 ? trecho.litros : grupo.litros * peso;

      if (trecho.rateioParticipacao) {
        const ownership = getAircraft(aircraftId)?.ownership ?? [];
        if (ownership.length === 0) {
          creditar(trecho.partnerId, valorTrecho, litrosTrecho, grupo.abastecimentoId);
          continue;
        }
        for (const owner of ownership) {
          creditar(
            owner.partnerId,
            valorTrecho * owner.share,
            litrosTrecho * owner.share,
            grupo.abastecimentoId,
          );
        }
        continue;
      }
      creditar(trecho.partnerId, valorTrecho, litrosTrecho, grupo.abastecimentoId);
    }
  }

  return [...mapa.values()]
    .map(({ abasts, ...item }) => ({
      ...item,
      abastecimentos: abasts.size,
    }))
    .sort(
      (left, right) =>
        right.combustivel - left.combustivel ||
        partnerShort(left.partnerId).localeCompare(partnerShort(right.partnerId)),
    );
}

function parseIsoDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / 86_400_000;
}

function deltaDiasEntre(a: string, b: string): number {
  return parseIsoDay(a) - parseIsoDay(b);
}

type TrechoComIcao = ConferenciaVibraTrecho & {
  fromIcao: string;
  toIcao: string;
  ordem: number;
};

const BASE_OPERACAO_ICAO = "SBTE";

/**
 * Ordena trechos na sequência real de voo (ordem do arquivo / encadeamento pela base).
 */
function ordenarTrechosPorSequencia<T extends TrechoComIcao>(trechos: T[]): T[] {
  if (trechos.length <= 1) return [...trechos];

  const porData = new Map<string, T[]>();
  for (const trecho of trechos) {
    const lista = porData.get(trecho.date) ?? [];
    lista.push(trecho);
    porData.set(trecho.date, lista);
  }

  const saida: T[] = [];
  for (const date of [...porData.keys()].sort()) {
    saida.push(...encadearTrechosDoDia(porData.get(date) ?? []));
  }
  return saida;
}

function elosContinuos(trechos: TrechoComIcao[]): number {
  let score = 0;
  for (let i = 1; i < trechos.length; i += 1) {
    if (trechos[i - 1]?.toIcao === trechos[i]?.fromIcao) score += 1;
  }
  return score;
}

function encadearTrechosDoDia<T extends TrechoComIcao>(trechos: T[]): T[] {
  if (trechos.length <= 1) return [...trechos];

  const porArquivo = [...trechos].sort(
    (left, right) =>
      left.ordem - right.ordem ||
      left.legId.localeCompare(right.legId, undefined, { numeric: true }),
  );
  if (elosContinuos(porArquivo) === porArquivo.length - 1) return porArquivo;

  let melhor = porArquivo;
  let melhorScore = -1;
  for (let start = 0; start < trechos.length; start += 1) {
    const remaining = [...trechos];
    const ordered: T[] = [remaining.splice(start, 1)[0]!];
    while (remaining.length > 0) {
      const pos = ordered[ordered.length - 1]?.toIcao;
      let idx = remaining.findIndex((item) => item.fromIcao === pos);
      if (idx < 0) {
        idx = remaining.findIndex((item) => item.fromIcao === BASE_OPERACAO_ICAO);
      }
      if (idx < 0) idx = 0;
      ordered.push(remaining.splice(idx, 1)[0]!);
    }
    let score = elosContinuos(ordered);
    if (ordered[0]?.fromIcao === BASE_OPERACAO_ICAO) score += 0.5;
    if (ordered[ordered.length - 1]?.toIcao === BASE_OPERACAO_ICAO) score += 0.25;
    if (score > melhorScore) {
      melhorScore = score;
      melhor = ordered;
    }
  }
  return melhor;
}

function listarTrechosVibra(aircraftFilter: string): TrechoComIcao[] {
  const trechos: TrechoComIcao[] = [];
  for (const trip of getBase().itineraries) {
    if (trip.status === "cancelado") continue;
    if (!matchesAircraft(trip.aircraftId, aircraftFilter)) continue;
    for (const leg of trip.legs) {
      if (!postingConsomeCombustivel(leg, trip)) continue;
      const litros = litrosConsumidosTrecho(trip.aircraftId, leg.blockHours);
      if (!(leg.blockHours > 0) && !(litros > 0)) continue;
      trechos.push({
        itineraryId: trip.id,
        legId: leg.id,
        route: rotaTrecho(leg),
        date: leg.date,
        blockHours: leg.blockHours,
        litros,
        partnerId: trip.requestedBy,
        rateioParticipacao: allocationDoVoo(trip) === "participacao",
        diaVizinho: false,
        deltaDias: 0,
        eloFora: false,
        fromIcao: leg.fromIcao,
        toIcao: leg.toIcao,
        ordem: leg.ordem ?? (Number.parseInt(leg.id.replace(/\D+/g, ""), 10) || 0),
      });
    }
  }
  const ordenados = ordenarTrechosPorSequencia(trechos);
  ordenados.forEach((trecho, index) => {
    trecho.ordem = index + 1;
  });
  return ordenados;
}

export type NotaVibraProxima = {
  abastecimentoId: string;
  referencia: string;
  date: string;
  icao: string;
  cidade: string | null;
  litros: number;
  amount: number | null;
  precoLitro: number | null;
  anexoUrl?: string;
  notaNumero: string | null;
  deltaDiasMin: number;
  mesmoIcao: boolean;
  /** 1º trecho do conjunto (existentes + seleção) parte do ICAO do abast. */
  origemCompativel: boolean;
  motivoIncompativel: string | null;
  trechosJaAlocados: number;
  litrosConsumoAlocados: number;
};

/**
 * NFs Vibra na janela ±7 dias do intervalo dos trechos selecionados.
 * Destaca mesmo ICAO de algum trecho selecionado.
 */
export function notasProximasVibra(
  months: MonthFilter,
  aircraftId: string,
  legIds: string[],
): NotaVibraProxima[] {
  const aircraftFilter = aircraftId === "todas" ? "psjsa" : aircraftId;
  const trechos = listarTrechosVibra(aircraftFilter).filter(
    (item) => matchesMonth(item.date.slice(0, 7), months) || legIds.includes(item.legId),
  );
  const selecionados = trechos.filter((item) => legIds.includes(item.legId));
  if (selecionados.length === 0) return [];

  const datas = selecionados.map((item) => item.date).sort();
  const inicio = datas[0]!;
  const fim = datas[datas.length - 1]!;
  const icaos = new Set(
    selecionados.flatMap((item) => [item.fromIcao, item.toIcao]),
  );

  const alocacoes = getBase().alocacoesVibra ?? [];
  const litrosPorLeg = new Map(trechos.map((item) => [item.legId, item.litros]));
  const porAbast = new Map<string, { trechos: number; litros: number }>();
  for (const aloc of alocacoes) {
    const atual = porAbast.get(aloc.abastecimentoId) ?? { trechos: 0, litros: 0 };
    atual.trechos += 1;
    atual.litros += litrosPorLeg.get(aloc.legId) ?? 0;
    porAbast.set(aloc.abastecimentoId, atual);
  }

  return ABASTECIMENTOS_VIBRA.filter((abast) => {
    if (!matchesMonth(abast.date.slice(0, 7), months)) {
      // ainda inclui se cair na janela dos trechos selecionados
      const deltaIni = deltaDiasEntre(abast.date, inicio);
      const deltaFim = deltaDiasEntre(abast.date, fim);
      if (deltaIni < -7 || deltaFim > 7) return false;
    }
    const distInicio = Math.abs(deltaDiasEntre(abast.date, inicio));
    const distFim = Math.abs(deltaDiasEntre(abast.date, fim));
    return Math.min(distInicio, distFim) <= 7 || matchesMonth(abast.date.slice(0, 7), months);
  })
    .map((abast) => {
      const deltas = selecionados.map((item) => Math.abs(deltaDiasEntre(abast.date, item.date)));
      const deltaDiasMin = Math.min(...deltas);
      const amount = abast.notaAmount;
      const uso = porAbast.get(abast.id) ?? { trechos: 0, litros: 0 };
      const validacao = validarOrigemAbastecimentoVibra(legIds, abast.id, aircraftFilter);
      return {
        abastecimentoId: abast.id,
        referencia: abast.referencia,
        date: abast.date,
        icao: abast.icao,
        cidade: abast.cidade,
        litros: abast.litros,
        amount,
        precoLitro: amount != null && abast.litros > 0 ? amount / abast.litros : null,
        anexoUrl: abast.anexoUrl,
        notaNumero: abast.notaNumero,
        deltaDiasMin,
        mesmoIcao: icaos.has(abast.icao),
        origemCompativel: validacao.ok,
        motivoIncompativel: validacao.ok ? null : validacao.motivo,
        trechosJaAlocados: uso.trechos,
        litrosConsumoAlocados: uso.litros,
      };
    })
    .filter((item) => item.deltaDiasMin <= 7)
    .sort(
      (left, right) =>
        (left.origemCompativel === right.origemCompativel ? 0 : left.origemCompativel ? -1 : 1) ||
        (left.mesmoIcao === right.mesmoIcao ? 0 : left.mesmoIcao ? -1 : 1) ||
        left.deltaDiasMin - right.deltaDiasMin ||
        left.date.localeCompare(right.date) ||
        left.referencia.localeCompare(right.referencia),
    );
}

/** Trechos da saída contínua (mesmo dia, destino→origem) a partir de um leg. */
export function legIdsSaidaContinua(
  linhas: ConferenciaVibraLinha[],
  legId: string,
): string[] {
  const ordenadas = [...linhas].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.ordem - right.ordem ||
      left.legId.localeCompare(right.legId, undefined, { numeric: true }),
  );
  const idx = ordenadas.findIndex((item) => item.legId === legId);
  if (idx < 0) return [legId];
  const base = ordenadas[idx]!;
  let inicio = idx;
  let fim = idx;
  while (
    inicio > 0 &&
    ordenadas[inicio - 1]?.date === base.date &&
    ordenadas[inicio - 1]?.toIcao === ordenadas[inicio]?.fromIcao
  ) {
    inicio -= 1;
  }
  while (
    fim + 1 < ordenadas.length &&
    ordenadas[fim + 1]?.date === base.date &&
    ordenadas[fim]?.toIcao === ordenadas[fim + 1]?.fromIcao
  ) {
    fim += 1;
  }
  return ordenadas.slice(inicio, fim + 1).map((item) => item.legId);
}

/**
 * Conferência Vibra por alocação manual (sem match automático).
 * Alias estável usado pela UI/PDF/Excel.
 */
export function conferenciaVibraManual(
  months: MonthFilter,
  aircraftId: string,
): ConferenciaVibraPorData {
  return conferenciaVibraPorDataDoc(months, aircraftId);
}

/**
 * Conferência Vibra: lista de trechos + alocações manuais persistidas.
 */
export function conferenciaVibraPorDataDoc(
  months: MonthFilter,
  aircraftId: string,
): ConferenciaVibraPorData {
  const aircraftFilter = aircraftId === "todas" ? "psjsa" : aircraftId;
  const trechos = listarTrechosVibra(aircraftFilter).filter((trecho) =>
    matchesMonth(trecho.date.slice(0, 7), months),
  );

  const alocPorLeg = new Map(
    (getBase().alocacoesVibra ?? []).map((item) => [item.legId, item.abastecimentoId]),
  );
  const abastPorId = new Map(ABASTECIMENTOS_VIBRA.map((item) => [item.id, item]));

  type GrupoManual = GrupoAbastMatch;
  const gruposMap = new Map<string, GrupoManual>();

  for (const trecho of trechos) {
    const abastecimentoId = alocPorLeg.get(trecho.legId);
    if (!abastecimentoId) continue;
    const abast = abastPorId.get(abastecimentoId);
    if (!abast) continue;

    let grupo = gruposMap.get(abastecimentoId);
    if (!grupo) {
      const amount = abast.notaAmount;
      grupo = {
        abastecimentoId: abast.id,
        referencia: abast.referencia,
        abastDate: abast.date,
        icao: abast.icao,
        cidade: abast.cidade,
        litros: abast.litros,
        amount,
        notaNumero: abast.notaNumero,
        notaDate: abast.notaDate,
        anexoUrl: abast.anexoUrl,
        precoLitro: amount != null && abast.litros > 0 ? amount / abast.litros : null,
        trechosVizinhos: false,
        trechos: [],
        litrosCalc: 0,
        deltaLitros: null,
        status: "ok",
        detalhe: "",
      };
      gruposMap.set(abastecimentoId, grupo);
    }

    const delta = deltaDiasEntre(trecho.date, abast.date);
    if (delta !== 0) grupo.trechosVizinhos = true;
    grupo.trechos.push({
      itineraryId: trecho.itineraryId,
      legId: trecho.legId,
      route: trecho.route,
      date: trecho.date,
      blockHours: trecho.blockHours,
      litros: trecho.litros,
      partnerId: trecho.partnerId,
      rateioParticipacao: trecho.rateioParticipacao,
      diaVizinho: delta !== 0,
      deltaDias: delta,
      eloFora: !(trecho.fromIcao === abast.icao || trecho.toIcao === abast.icao),
    });
    grupo.litrosCalc += trecho.litros;
  }

  const fromPorLeg = new Map(trechos.map((item) => [item.legId, item.fromIcao]));

  const precos = [...gruposMap.values()]
    .map((item) => item.precoLitro)
    .filter((item): item is number => item != null && item > 0);
  const precoLitroMediano = mediana(precos);

  const ordemPorLeg = new Map(trechos.map((item) => [item.legId, item.ordem]));

  for (const grupo of gruposMap.values()) {
    grupo.deltaLitros = centavos(grupo.litros - grupo.litrosCalc);
    const delta = grupo.deltaLitros ?? 0;
    const foraFaixaPreco =
      precoLitroMediano != null &&
      grupo.precoLitro != null &&
      (grupo.precoLitro / precoLitroMediano < 0.75 ||
        grupo.precoLitro / precoLitroMediano > 1.4);
    const litrosFolgados = Math.abs(delta) > Math.max(80, grupo.litrosCalc * 0.45);

    if (litrosFolgados || foraFaixaPreco) {
      grupo.status = "atencao";
      grupo.detalhe = litrosFolgados
        ? `NF ${grupo.litros.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L vs consumo ${grupo.litrosCalc.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L.`
        : `R$/L fora da faixa (mediana ${precoLitroMediano?.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}).`;
    } else if (grupo.trechosVizinhos) {
      grupo.status = "vizinho";
      grupo.detalhe = `Trechos em data diferente do abast. ${grupo.abastDate.slice(8, 10)}/${grupo.abastDate.slice(5, 7)}.`;
    } else {
      grupo.status = "ok";
      grupo.detalhe = `${grupo.trechos.length} trecho(s) alocado(s).`;
    }
  }

  type HitLeg = {
    grupo: GrupoManual;
    trecho: ConferenciaVibraTrecho;
    primeiroDoGrupo: boolean;
    saldoAposTrecho: number;
    status: ConferenciaVibraStatus;
    detalhe: string;
  };

  const grupos = [...gruposMap.values()];
  const porLeg = new Map<string, HitLeg>();
  for (const grupo of grupos) {
    const ordenados = [...grupo.trechos].sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        (ordemPorLeg.get(left.legId) ?? 0) - (ordemPorLeg.get(right.legId) ?? 0) ||
        left.legId.localeCompare(right.legId, undefined, { numeric: true }),
    );
    const primeiro = ordenados[0];
    const origemPrimeiro = primeiro ? fromPorLeg.get(primeiro.legId) : undefined;
    const origemInvalida = Boolean(origemPrimeiro && origemPrimeiro !== grupo.icao);
    let saldo = grupo.litros;
    ordenados.forEach((trecho, index) => {
      const consumo = trecho.litros;
      let detalhe: string;
      let status: ConferenciaVibraStatus = "ok";
      if (origemInvalida && index === 0) {
        detalhe = `Origem incompatível: NF em ${grupo.icao}, mas o 1º trecho parte de ${origemPrimeiro}. Não apagado — revise a alocação.`;
        status = "atencao";
        saldo = centavos(Math.max(0, saldo - consumo));
      } else if (saldo >= consumo - 0.05) {
        saldo = centavos(saldo - consumo);
        detalhe =
          saldo > 1
            ? `Cobre este trecho (${consumo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L) · sobram ${saldo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`
            : `Cobre este trecho (${consumo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L) · NF encerrada`;
        if (origemInvalida) {
          status = "atencao";
          detalhe = `Saldo após origem inválida · ${detalhe}`;
        } else {
          const sobraGrande =
            index === ordenados.length - 1 &&
            saldo > Math.max(80, grupo.litrosCalc * 0.45);
          if (sobraGrande) status = "atencao";
          else if (grupo.trechosVizinhos) status = "vizinho";
          else status = "ok";
        }
      } else if (saldo > 1) {
        const falta = centavos(consumo - saldo);
        detalhe = `Cobre parcialmente (${saldo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L de ${consumo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L) · faltam ${falta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`;
        saldo = 0;
        status = "atencao";
      } else {
        detalhe = `Sem saldo da NF · precisa ${consumo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`;
        saldo = 0;
        status = "atencao";
      }
      porLeg.set(trecho.legId, {
        grupo,
        trecho,
        primeiroDoGrupo: index === 0,
        saldoAposTrecho: saldo,
        status,
        detalhe,
      });
    });
  }

  const linhas: ConferenciaVibraLinha[] = trechos.map((base) => {
    const trip = getItinerary(base.itineraryId);
    const acId = trip?.aircraftId ?? aircraftFilter;
    const hit = porLeg.get(base.legId);
    if (!hit) {
      return {
        key: base.legId,
        itineraryId: base.itineraryId,
        legId: base.legId,
        ordem: base.ordem,
        date: base.date,
        month: base.date.slice(0, 7),
        aircraftId: acId,
        partnerId: base.partnerId,
        rateioParticipacao: base.rateioParticipacao,
        route: base.route,
        fromIcao: base.fromIcao,
        toIcao: base.toIcao,
        blockHours: base.blockHours,
        litrosCalc: base.litros,
        abastecimentoId: null,
        referencia: null,
        abastDate: null,
        icao: null,
        cidade: null,
        litrosAbast: null,
        amount: null,
        notaNumero: null,
        notaDate: null,
        precoLitro: null,
        matchTipo: "sem_abast",
        deltaDias: 0,
        primeiroDoGrupo: false,
        grupoTrechos: 0,
        litrosGrupoCalc: 0,
        deltaLitrosGrupo: null,
        saldoAposTrecho: null,
        status: "sem_abast",
        detalhe: "Sem NF alocada — selecione o trecho e escolha um comprovante.",
      };
    }

    const { grupo, trecho, primeiroDoGrupo, saldoAposTrecho, status, detalhe } = hit;
    const matchTipo: ConferenciaVibraMatchTipo = trecho.eloFora
      ? "elo"
      : trecho.diaVizinho
        ? "vizinho"
        : "mesmo_dia";

    return {
      key: base.legId,
      itineraryId: base.itineraryId,
      legId: base.legId,
      ordem: base.ordem,
      date: base.date,
      month: base.date.slice(0, 7),
      aircraftId: acId,
      partnerId: base.partnerId,
      rateioParticipacao: base.rateioParticipacao,
      route: base.route,
      fromIcao: base.fromIcao,
      toIcao: base.toIcao,
      blockHours: base.blockHours,
      litrosCalc: base.litros,
      abastecimentoId: grupo.abastecimentoId,
      referencia: grupo.referencia,
      abastDate: grupo.abastDate,
      icao: grupo.icao,
      cidade: grupo.cidade,
      litrosAbast: grupo.litros,
      amount: grupo.amount,
      notaNumero: grupo.notaNumero,
      notaDate: grupo.notaDate,
      anexoUrl: grupo.anexoUrl,
      precoLitro: grupo.precoLitro,
      matchTipo,
      deltaDias: trecho.deltaDias,
      primeiroDoGrupo,
      grupoTrechos: grupo.trechos.length,
      litrosGrupoCalc: grupo.litrosCalc,
      deltaLitrosGrupo: grupo.deltaLitros,
      saldoAposTrecho,
      status,
      detalhe,
    };
  });

  const alocadosIds = new Set(alocPorLeg.values());
  const orfaos: ConferenciaVibraOrfa[] = ABASTECIMENTOS_VIBRA.filter(
    (abast) => matchesMonth(abast.date.slice(0, 7), months) && !alocadosIds.has(abast.id),
  ).map((abast) => {
    const amount = abast.notaAmount;
    return {
      key: abast.id,
      abastecimentoId: abast.id,
      referencia: abast.referencia,
      date: abast.date,
      icao: abast.icao,
      cidade: abast.cidade,
      litros: abast.litros,
      amount,
      notaNumero: abast.notaNumero,
      notaDate: abast.notaDate,
      anexoUrl: abast.anexoUrl,
      precoLitro: amount != null && abast.litros > 0 ? amount / abast.litros : null,
      detalhe: "Comprovante ainda sem trechos alocados.",
    };
  });

  const numsComprovante = new Set(
    ABASTECIMENTOS_VIBRA.map((item) => item.notaNumero).filter(
      (item): item is string => Boolean(item),
    ),
  );
  const notasPeriodo = NOTAS_FISCAIS.filter(
    (item) =>
      item.origem === "vibra" &&
      item.amount > 0 &&
      matchesAircraft(item.aircraftId, aircraftFilter) &&
      matchesMonth(item.month, months),
  );
  const refPorNumero = new Map(
    FATURAMENTO_VIBRA.map((item) => [item.numero, item.referencia]),
  );
  const notasSemComprovante: ConferenciaVibraNotaOrfa[] = notasPeriodo
    .filter((item) => !numsComprovante.has(item.numero))
    .map((item) => ({
      numero: item.numero,
      date: item.date,
      amount: item.amount,
      referencia: refPorNumero.get(item.numero) ?? null,
    }))
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) || left.numero.localeCompare(right.numero),
    );

  const abastsNoPeriodo = ABASTECIMENTOS_VIBRA.filter((item) =>
    matchesMonth(item.date.slice(0, 7), months),
  );
  const comMatch = grupos.filter((item) => item.trechos.length > 0);

  return {
    linhas,
    orfaos,
    totalAbastecimentos: abastsNoPeriodo.length,
    totalValor: centavos(
      abastsNoPeriodo.reduce((soma, item) => soma + (item.notaAmount ?? 0), 0),
    ),
    totalLitros: abastsNoPeriodo.reduce((soma, item) => soma + item.litros, 0),
    comVoo: comMatch.length,
    semVoo: orfaos.length,
    atencao: grupos.filter((item) => item.status === "atencao").length,
    semAbast: linhas.filter((item) => item.status === "sem_abast").length,
    precoLitroMediano,
    totalFaturadoPeriodo: centavos(
      notasPeriodo.reduce((soma, item) => soma + item.amount, 0),
    ),
    notasSemComprovante,
    porSolicitante: agregarSolicitantesVibra(comMatch, aircraftFilter),
  };
}
