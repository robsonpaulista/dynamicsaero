import { NOTAS_FISCAIS } from "@/data/caso-real";
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
