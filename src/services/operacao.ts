import { HOJE, MONTHS, VIEWER_ID } from "@/data/calendario";
import { NOTAS_FISCAIS } from "@/data/caso-real";
import { getBase } from "@/services/dados";
import { daysUntil, formatBRL, formatDate, formatMil, formatPercent } from "@/lib/format";
import { METODO_LABEL, POSTING_LABEL, ROLE_LABEL } from "@/lib/labels";
import type {
  Aircraft,
  Alerta,
  Aporte,
  AporteAplicado,
  CategoryTotal,
  ContaCorrente,
  ContaPlano,
  CrewMember,
  Expense,
  ExpenseCategory,
  FaixaEscala,
  Hangar,
  Insurance,
  Itinerary,
  Kpis,
  LancamentoConta,
  Leg,
  MaintenanceItem,
  NotaFiscal,
  Partner,
  Posting,
  Rota,
  Rateio,
  RateioPartner,
} from "@/types/operacao";
import { mesclarContasPlano } from "@/data/plano-contas";

export { HOJE, MONTHS, VIEWER_ID };

const VENDORS: Record<"combustivel" | "taxas" | "handling" | "catering", string> = {
  combustivel: "Vibra Aviação",
  taxas: "Concessionária do aeródromo",
  handling: "Atendimento de pátio",
  catering: "Catering de bordo",
};

export function listAircraft(): Aircraft[] {
  return getBase().aircraft;
}

export function getAircraft(id: string): Aircraft | undefined {
  return getBase().aircraft.find((item) => item.id === id);
}

/** Consumo médio (gal/h) cadastrado na aeronave — base do custo automático de combustível. */
export const CONSUMO_COMBUSTIVEL_PADRAO_GPH = 74;

/** Conversão US gal → litros (NFs Vibra em litros; consumo da frota em gal/h). */
export const GALAO_EM_LITROS = 3.785411784;

export function consumoMedioGph(aircraftId: string): number {
  const valor = getAircraft(aircraftId)?.fuelBurnGph;
  return typeof valor === "number" && valor > 0 ? valor : CONSUMO_COMBUSTIVEL_PADRAO_GPH;
}

/** Preço unitário do abastecimento (R$/L), ou null se inválido. */
export function precoPorLitroAbastecimento(abastecimento: {
  valor: number;
  litros: number;
}): number | null {
  if (!(abastecimento.valor > 0) || !(abastecimento.litros > 0)) return null;
  return abastecimento.valor / abastecimento.litros;
}

/** Litros consumidos no trecho: horas × gal/h × conversão. */
export function litrosConsumidosTrecho(aircraftId: string, blockHours: number): number {
  if (!(blockHours > 0)) return 0;
  return blockHours * consumoMedioGph(aircraftId) * GALAO_EM_LITROS;
}

/** Valor estimado do consumo (só referência; a NF é a despesa financeira). */
export function custoCombustivelPorConsumo(
  aircraftId: string,
  blockHours: number,
  precoPorLitro: number,
): number {
  if (!(precoPorLitro > 0)) return 0;
  return Math.round(litrosConsumidosTrecho(aircraftId, blockHours) * precoPorLitro * 100) / 100;
}

export type FatiaTanque = {
  abastecimentoId: string;
  itineraryId: string;
  legId: string;
  aircraftId: string;
  partnerId: string;
  date: string;
  litros: number;
  amount: number;
  fromIcao: string;
  toIcao: string;
  fromCity: string;
  toCity: string;
};

export type StatusTanque = {
  aircraftId: string;
  litrosComprados: number;
  litrosConsumidos: number;
  litrosSaldo: number;
  valorComprado: number;
  valorDistribuido: number;
  valorSaldo: number;
};

function dataAbastecimento(trip: Itinerary): string {
  return trip.legs[0]?.date ?? "";
}

function centavosValor(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Consome o tanque da aeronave em FIFO: NFs de abastecimento × pernas realizadas.
 * Cada fatia rateia o valor da NF ao solicitante do voo pelos litros.
 */
export function alocarTanqueCombustivel(aircraftId?: string): FatiaTanque[] {
  const trips = getBase().itineraries.filter(
    (trip) => trip.status !== "cancelado" && (!aircraftId || trip.aircraftId === aircraftId),
  );

  type Lote = {
    abastecimentoId: string;
    aircraftId: string;
    litrosRestantes: number;
    valorRestantes: number;
  };

  const lotesPorAeronave = new Map<string, Lote[]>();
  const abastecimentos = trips
    .filter((trip) => trip.abastecimento && trip.abastecimento.valor > 0 && trip.abastecimento.litros > 0)
    .sort(
      (left, right) =>
        dataAbastecimento(left).localeCompare(dataAbastecimento(right)) ||
        left.id.localeCompare(right.id),
    );

  for (const trip of abastecimentos) {
    const abast = trip.abastecimento;
    if (!abast) continue;
    const lista = lotesPorAeronave.get(trip.aircraftId) ?? [];
    lista.push({
      abastecimentoId: trip.id,
      aircraftId: trip.aircraftId,
      litrosRestantes: abast.litros,
      valorRestantes: abast.valor,
    });
    lotesPorAeronave.set(trip.aircraftId, lista);
  }

  type Demanda = {
    trip: Itinerary;
    leg: Leg;
    litros: number;
  };

  const demandas: Demanda[] = [];
  for (const trip of trips) {
    for (const leg of trip.legs) {
      if (legPosting(leg, trip) !== "realizado") continue;
      const litros = litrosConsumidosTrecho(trip.aircraftId, leg.blockHours);
      if (litros <= 0) continue;
      demandas.push({ trip, leg, litros });
    }
  }
  demandas.sort(
    (left, right) =>
      left.leg.date.localeCompare(right.leg.date) ||
      left.leg.depart.localeCompare(right.leg.depart) ||
      left.leg.id.localeCompare(right.leg.id),
  );

  const fatias: FatiaTanque[] = [];
  for (const demanda of demandas) {
    let falta = demanda.litros;
    const lotes = lotesPorAeronave.get(demanda.trip.aircraftId) ?? [];
    while (falta > 1e-9 && lotes.length > 0) {
      const lote = lotes[0];
      if (!lote || lote.litrosRestantes <= 1e-9) {
        lotes.shift();
        continue;
      }
      const take = Math.min(falta, lote.litrosRestantes);
      const fechaLote = take >= lote.litrosRestantes - 1e-9;
      const amount = fechaLote
        ? centavosValor(lote.valorRestantes)
        : centavosValor((take / lote.litrosRestantes) * lote.valorRestantes);
      if (amount > 0) {
        fatias.push({
          abastecimentoId: lote.abastecimentoId,
          itineraryId: demanda.trip.id,
          legId: demanda.leg.id,
          aircraftId: demanda.trip.aircraftId,
          partnerId: demanda.trip.requestedBy,
          date: demanda.leg.date,
          litros: take,
          amount,
          fromIcao: demanda.leg.fromIcao,
          toIcao: demanda.leg.toIcao,
          fromCity: demanda.leg.fromCity,
          toCity: demanda.leg.toCity,
        });
      }
      lote.litrosRestantes = Math.max(0, lote.litrosRestantes - take);
      lote.valorRestantes = Math.max(0, centavosValor(lote.valorRestantes - amount));
      falta -= take;
      if (lote.litrosRestantes <= 1e-9 || lote.valorRestantes <= 0) {
        lotes.shift();
      }
    }
  }
  return fatias;
}

export function statusTanqueAeronave(aircraftId: string): StatusTanque {
  const fatias = alocarTanqueCombustivel(aircraftId);
  let litrosComprados = 0;
  let valorComprado = 0;
  for (const trip of getBase().itineraries) {
    if (trip.aircraftId !== aircraftId || trip.status === "cancelado") continue;
    const abast = trip.abastecimento;
    if (!abast || !(abast.valor > 0) || !(abast.litros > 0)) continue;
    litrosComprados += abast.litros;
    valorComprado += abast.valor;
  }
  const litrosConsumidos = fatias.reduce((soma, item) => soma + item.litros, 0);
  const valorDistribuido = fatias.reduce((soma, item) => soma + item.amount, 0);
  return {
    aircraftId,
    litrosComprados,
    litrosConsumidos,
    litrosSaldo: Math.max(0, litrosComprados - litrosConsumidos),
    valorComprado,
    valorDistribuido,
    valorSaldo: Math.max(0, centavosValor(valorComprado - valorDistribuido)),
  };
}

export function fatiasTanqueDoVoo(itineraryId: string): FatiaTanque[] {
  return alocarTanqueCombustivel().filter((item) => item.itineraryId === itineraryId);
}

export function listPartners(): Partner[] {
  return getBase().partners;
}

export function getPartner(id: string): Partner | undefined {
  return getBase().partners.find((item) => item.id === id);
}

export function partnerName(id: string): string {
  return getPartner(id)?.name ?? id;
}

export function partnerShort(id: string): string {
  return getPartner(id)?.shortName ?? id;
}

/** Cotista da sessão só quando o papel é Sócio e o nome bate com o cadastro. */
export function partnerIdDaSessao(nome: string, papel?: string): string | null {
  if (papel !== "socio") return null;
  const alvo = nome.trim().toLocaleLowerCase("pt-BR");
  if (!alvo) return null;
  const hit = listPartners().find((item) => {
    const completo = item.name.trim().toLocaleLowerCase("pt-BR");
    const curto = item.shortName.trim().toLocaleLowerCase("pt-BR");
    return alvo === completo || alvo === curto || alvo.startsWith(`${curto} `);
  });
  return hit?.id ?? null;
}

export function listCrew(): CrewMember[] {
  return getBase().crew;
}

export function getCrew(id: string): CrewMember | undefined {
  return getBase().crew.find((item) => item.id === id);
}

export function listHangars(): Hangar[] {
  return getBase().hangars;
}

export function hangarOf(aircraftId: string): Hangar | undefined {
  return getBase().hangars.find((item) => item.aircraftId === aircraftId);
}

export function getHangar(id: string): Hangar | undefined {
  return getBase().hangars.find((item) => item.id === id);
}

export function listMaintenance(): MaintenanceItem[] {
  return getBase().maintenance;
}

export function getMaintenance(id: string): MaintenanceItem | undefined {
  return getBase().maintenance.find((item) => item.id === id);
}

export function listRotas(): Rota[] {
  return getBase().rotas;
}

export function getRota(id: string): Rota | undefined {
  return getBase().rotas.find((item) => item.id === id);
}

export function listItinerarySource(): Itinerary[] {
  return getBase().itineraries;
}

export function getItinerary(id: string): Itinerary | undefined {
  return getBase().itineraries.find((item) => item.id === id);
}

export function getDespesaManual(id: string): Expense | undefined {
  const extra = getBase().extras.find((item) => item.id === id);
  return extra ? resolverRateioDespesa(extra) : undefined;
}

export function listContasPlano(): ContaPlano[] {
  return mesclarContasPlano(getBase().contas);
}

export function getContaPlano(id: string): ContaPlano | undefined {
  return listContasPlano().find((item) => item.id === id);
}

export function seguroDe(aircraftId: string): Insurance | undefined {
  return getBase().seguros.find((item) => item.aircraftId === aircraftId);
}

export function hrefOrigem(expense: Expense): string {
  if (expense.manual) return `/despesas/${expense.id}/editar`;
  if (expense.itineraryId) return `/itinerarios/${expense.itineraryId}/editar`;
  if (expense.maintenanceId) return `/manutencao/${expense.maintenanceId}/editar`;
  if (expense.hangarId) return `/hangar/${expense.hangarId}/editar`;
  if (expense.crewId) return `/despesas?recorte=fixas`;
  if (expense.category === "seguro") return `/frota/${expense.aircraftId}/editar`;
  return `/frota/${expense.aircraftId}/editar`;
}

function rotuloMes(month: string, curto: boolean): string {
  const known = MONTHS.find((item) => item.id === month);
  if (known) return curto ? known.short : known.label;
  const date = new Date(`${month}-15T12:00:00`);
  if (Number.isNaN(date.getTime())) return month;
  const options: Intl.DateTimeFormatOptions = curto
    ? { month: "short" }
    : { month: "long", year: "numeric" };
  const text = new Intl.DateTimeFormat("pt-BR", options).format(date);
  const clean = text.replace(".", "");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function monthLabel(month: string): string {
  return rotuloMes(month, false);
}

export function monthShort(month: string): string {
  return rotuloMes(month, true);
}

export type MonthFilter = string[];

/** `null` = todos os meses. */
export function monthsAtivos(filter: MonthFilter): string[] | null {
  if (filter.length === 0 || filter.includes("todos")) return null;
  return filter;
}

export function matchesMonth(competencia: string, filter: MonthFilter): boolean {
  const ativos = monthsAtivos(filter);
  if (!ativos) return true;
  return ativos.includes(competencia);
}

export function monthsLabel(filter: MonthFilter): string {
  const ativos = monthsAtivos(filter);
  if (!ativos) return "Todos os meses";
  if (ativos.length === 1) return monthLabel(ativos[0] ?? "");
  if (ativos.length === 2) {
    return `${monthShort(ativos[0] ?? "")} e ${monthShort(ativos[1] ?? "")}`;
  }
  return `${ativos.length} meses`;
}

export function mesDeReferencia(filter: MonthFilter): string {
  const ativos = monthsAtivos(filter);
  if (!ativos) {
    const lista = listMonths();
    return lista[lista.length - 1]?.id ?? HOJE.slice(0, 7);
  }
  return [...ativos].sort().at(-1) ?? HOJE.slice(0, 7);
}

export function listMonths(): { id: string; label: string; short: string }[] {
  const ids = new Set<string>(MONTHS.map((item) => item.id));
  for (const trip of getBase().itineraries) {
    for (const leg of trip.legs) ids.add(leg.date.slice(0, 7));
  }
  for (const item of getBase().maintenance) {
    if (item.competencia) ids.add(item.competencia);
  }
  for (const extra of getBase().extras) ids.add(extra.month);
  return [...ids]
    .filter((id) => /^\d{4}-\d{2}$/.test(id))
    .sort()
    .map((id) => ({ id, label: monthLabel(id), short: monthShort(id) }));
}

export function previousMonth(month: string): string | null {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  if (!year || !monthNumber) return null;
  const date = new Date(year, monthNumber - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function matchesAircraft(aircraftId: string, selected: string): boolean {
  return selected === "todas" || aircraftId === selected;
}

export function legPosting(leg: Leg, trip: Itinerary): Posting {
  if (trip.status === "cancelado") return "previsto";
  if (leg.posting) return leg.posting;
  return leg.date > HOJE ? "previsto" : "realizado";
}

export function itineraryRoute(trip: Itinerary): string {
  const first = trip.legs[0];
  if (!first) return "";
  const codes = [first.fromIcao, ...trip.legs.map((leg) => leg.toIcao)];
  return codes.join(" → ");
}

export function aerodromoLabel(city: string, icao: string): string {
  const nome = city.trim() || icao;
  return `${nome} (${icao})`;
}

export function itineraryCities(trip: Itinerary): string {
  const first = trip.legs[0];
  if (!first) return "";
  const trechos = [
    aerodromoLabel(first.fromCity, first.fromIcao),
    ...trip.legs.map((leg) => aerodromoLabel(leg.toCity, leg.toIcao)),
  ];
  const compact: string[] = [];
  for (const trecho of trechos) {
    if (compact[compact.length - 1] !== trecho) compact.push(trecho);
  }
  if (compact.length >= 3 && compact[0] === compact[compact.length - 1]) {
    return `${compact[0]} ↔ ${compact.slice(1, -1).join(" → ")}`;
  }
  return compact.join(" → ");
}

export function itinerarySpan(trip: Itinerary): { first: string; last: string } | null {
  const first = trip.legs[0]?.date;
  const last = trip.legs[trip.legs.length - 1]?.date;
  if (!first || !last) return null;
  return { first, last };
}

export function tripHours(trip: Itinerary): { voadas: number; previstas: number } {
  if (trip.status === "cancelado") return { voadas: 0, previstas: 0 };
  return trip.legs.reduce(
    (total, leg) => {
      const posting = legPosting(leg, trip);
      if (posting === "realizado") total.voadas += leg.blockHours;
      else total.previstas += leg.blockHours;
      return total;
    },
    { voadas: 0, previstas: 0 },
  );
}

function splitEqual(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / parts);
  const remainder = cents - base * parts;
  return Array.from({ length: parts }, (_, index) => {
    const extra = index === parts - 1 ? remainder : 0;
    return (base + extra) / 100;
  });
}

function splitByShare(
  total: number,
  shares: { partnerId: string; share: number }[],
): { partnerId: string; amount: number }[] {
  const cents = Math.round(total * 100);
  const raw = shares.map((item) => ({
    partnerId: item.partnerId,
    cents: Math.round(cents * item.share),
  }));
  const drift = cents - raw.reduce((sum, item) => sum + item.cents, 0);
  const last = raw[raw.length - 1];
  if (last) last.cents += drift;
  return raw.map((item) => ({
    partnerId: item.partnerId,
    amount: item.cents / 100,
  }));
}

function buildExpenses(): Expense[] {
  const expenses: Expense[] = [];

  for (const month of listMonths()) {
    for (const hangar of getBase().hangars) {
      expenses.push({
        id: `${month.id}-${hangar.id}`,
        aircraftId: hangar.aircraftId,
        hangarId: hangar.id,
        month: month.id,
        date: `${month.id}-01`,
        category: "hangar",
        description: `${hangar.name} · ${hangar.slot}`,
        vendor: hangar.vendor,
        amount: hangar.monthlyFee,
        allocation: "participacao",
        posting: "realizado",
      });
    }

    for (const insurance of getBase().seguros) {
      expenses.push({
        id: `${month.id}-seguro-${insurance.aircraftId}`,
        aircraftId: insurance.aircraftId,
        month: month.id,
        date: `${month.id}-01`,
        category: "seguro",
        description: insurance.description,
        vendor: insurance.vendor,
        amount: insurance.amount,
        allocation: "participacao",
        posting: "realizado",
      });
    }

    for (const person of getBase().crew) {
      if (person.monthlyCost <= 0) continue;
      const parts = splitEqual(person.monthlyCost, person.aircraftIds.length);
      person.aircraftIds.forEach((aircraftId, index) => {
        const amount = parts[index] ?? 0;
        if (amount <= 0) return;
        expenses.push({
          id: `${month.id}-crew-${person.id}-${aircraftId}`,
          aircraftId,
          crewId: person.id,
          month: month.id,
          date: `${month.id}-05`,
          category: person.role === "gestor" ? "administrativo" : "tripulacao",
          description: `${ROLE_LABEL[person.role]} · ${person.name}`,
          vendor: "Folha da operação",
          amount,
          allocation: "participacao",
          posting: "realizado",
        });
      });
    }
  }

  for (const trip of getBase().itineraries) {
    if (trip.status === "cancelado") continue;

    const abast = trip.abastecimento;
    if (abast && abast.valor > 0 && abast.litros > 0) {
      const dataNf = dataAbastecimento(trip) || HOJE;
      expenses.push({
        id: `abast-${trip.id}`,
        aircraftId: trip.aircraftId,
        itineraryId: trip.id,
        month: dataNf.slice(0, 7),
        date: dataNf,
        category: "combustivel",
        description: `Abastecimento · ${abast.litros.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L · ${trip.title}`,
        vendor: VENDORS.combustivel,
        amount: abast.valor,
        allocation: "participacao",
        posting: "realizado",
        origem: "abastecimento",
        abastecimentoId: trip.id,
      });
    }

    for (const leg of trip.legs) {
      const posting = legPosting(leg, trip);
      const month = leg.date.slice(0, 7);
      const origem = aerodromoLabel(leg.fromCity, leg.fromIcao);
      const destino = aerodromoLabel(leg.toCity, leg.toIcao);
      const items: Array<{
        category: "taxas" | "handling" | "catering";
        amount: number;
        description: string;
      }> = [
        {
          category: "taxas",
          amount: leg.fees,
          description: `Taxas · ${destino}`,
        },
        {
          category: "handling",
          amount: leg.handling,
          description: `Pátio · ${destino}`,
        },
        {
          category: "catering",
          amount: leg.catering,
          description: `Catering · ${origem} → ${destino}`,
        },
      ];

      for (const item of items) {
        if (item.amount <= 0) continue;
        expenses.push({
          id: `${leg.id}-${item.category}`,
          aircraftId: trip.aircraftId,
          itineraryId: trip.id,
          legId: leg.id,
          month,
          date: leg.date,
          category: item.category,
          description: item.description,
          vendor: VENDORS[item.category],
          amount: item.amount,
          allocation: "solicitante",
          partnerId: trip.requestedBy,
          posting,
        });
      }
    }
  }

  for (const fatia of alocarTanqueCombustivel()) {
    const origem = aerodromoLabel(fatia.fromCity, fatia.fromIcao);
    const destino = aerodromoLabel(fatia.toCity, fatia.toIcao);
    expenses.push({
      id: `tanque-${fatia.legId}-${fatia.abastecimentoId}`,
      aircraftId: fatia.aircraftId,
      itineraryId: fatia.itineraryId,
      legId: fatia.legId,
      month: fatia.date.slice(0, 7),
      date: fatia.date,
      category: "combustivel",
      description: `Combustível (consumo) · ${origem} → ${destino} · ${fatia.litros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`,
      vendor: VENDORS.combustivel,
      amount: fatia.amount,
      allocation: "solicitante",
      partnerId: fatia.partnerId,
      posting: "realizado",
      origem: "consumo-tanque",
      abastecimentoId: fatia.abastecimentoId,
    });
  }

  for (const item of getBase().maintenance) {
    if (!item.competencia || item.cost <= 0 || !item.posting) continue;
    expenses.push({
      id: `mx-${item.id}`,
      aircraftId: item.aircraftId,
      maintenanceId: item.id,
      month: item.competencia,
      date: item.openedAt,
      category: "manutencao",
      description: item.title,
      vendor: item.vendor,
      amount: item.cost,
      allocation: "participacao",
      posting: item.posting,
    });
  }

  return expenses;
}

type TarifaPouso = { pouso: string; from: string; to: string };

function parseTarifaPouso(description: string): TarifaPouso | null {
  const match = description.match(
    /^Tarifa de pouso ([A-Z0-9]{4})\s*·\s*([A-Z0-9]{4})→([A-Z0-9]{4})/i,
  );
  if (!match) return null;
  const pouso = match[1];
  const from = match[2];
  const to = match[3];
  if (!pouso || !from || !to) return null;
  return {
    pouso: pouso.toUpperCase(),
    from: from.toUpperCase(),
    to: to.toUpperCase(),
  };
}

function casarTarifaComEtapa(
  expense: Expense,
): { trip: Itinerary; leg: Leg } | null {
  const tarifa = parseTarifaPouso(expense.description);
  if (!tarifa) return null;

  const candidatos: Array<{ trip: Itinerary; leg: Leg; score: number }> = [];
  for (const trip of getBase().itineraries) {
    if (trip.aircraftId !== expense.aircraftId) continue;
    if (trip.status === "cancelado") continue;
    for (const leg of trip.legs) {
      if (leg.date !== expense.date) continue;
      let score = 0;
      if (leg.toIcao === tarifa.pouso) score += 4;
      if (leg.fromIcao === tarifa.pouso) score += 2;
      if (leg.fromIcao === tarifa.from && leg.toIcao === tarifa.to) score += 3;
      if (leg.fromIcao === tarifa.from || leg.toIcao === tarifa.to) score += 1;
      if (score <= 0) continue;
      candidatos.push({ trip, leg, score });
    }
  }
  if (candidatos.length === 0) return null;
  candidatos.sort(
    (left, right) =>
      right.score - left.score || left.leg.id.localeCompare(right.leg.id),
  );
  const melhor = candidatos[0];
  return melhor ? { trip: melhor.trip, leg: melhor.leg } : null;
}

/** Tarifa de pouso com voo casado → solicitante; sem voo → participação. */
export function resolverRateioDespesa(expense: Expense): Expense {
  if (expense.category !== "taxas") return expense;
  if (!parseTarifaPouso(expense.description)) return expense;

  const casado = casarTarifaComEtapa(expense);
  if (!casado) {
    if (expense.allocation === "participacao" && !expense.partnerId) return expense;
    return {
      ...expense,
      allocation: "participacao",
      partnerId: undefined,
      itineraryId: undefined,
      legId: undefined,
    };
  }

  return {
    ...expense,
    allocation: "solicitante",
    partnerId: casado.trip.requestedBy,
    itineraryId: casado.trip.id,
    legId: casado.leg.id,
  };
}

export function listExpenses(): Expense[] {
  return [...buildExpenses(), ...getBase().extras.map(resolverRateioDespesa)];
}

/** NF e demais custos — sem fatias de consumo do tanque (evita double count). */
export function eDespesaFinanceira(expense: Expense): boolean {
  return expense.origem !== "consumo-tanque";
}

/** Entra no rateio dos sócios — NF de abastecimento fica de fora (só as fatias). */
export function eDespesaRateavel(expense: Expense): boolean {
  return expense.origem !== "abastecimento";
}

export function expensesIn(months: MonthFilter, aircraftId: string): Expense[] {
  return listExpenses().filter(
    (item) => matchesMonth(item.month, months) && matchesAircraft(item.aircraftId, aircraftId),
  );
}

export function expensesOfItinerary(itineraryId: string): Expense[] {
  return listExpenses().filter((item) => item.itineraryId === itineraryId);
}

export function listNotasFiscais(months: MonthFilter, aircraftId: string): NotaFiscal[] {
  return NOTAS_FISCAIS.filter(
    (item) => matchesMonth(item.month, months) && matchesAircraft(item.aircraftId, aircraftId),
  ).sort((left, right) => right.date.localeCompare(left.date) || right.numero.localeCompare(left.numero));
}

export function itinerariesIn(months: MonthFilter, aircraftId: string): Itinerary[] {
  return getBase().itineraries.filter((trip) => {
    if (!matchesAircraft(trip.aircraftId, aircraftId)) return false;
    return trip.legs.some((leg) => matchesMonth(leg.date.slice(0, 7), months));
  });
}

export function sortAgenda(trips: Itinerary[]): Itinerary[] {
  const rank: Record<Itinerary["status"], number> = {
    em_voo: 0,
    confirmado: 1,
    previsto: 1,
    concluido: 2,
    cancelado: 3,
  };
  return [...trips].sort((left, right) => {
    const rankDelta = rank[left.status] - rank[right.status];
    if (rankDelta !== 0) return rankDelta;
    const leftDate = left.legs[0]?.date ?? "";
    const rightDate = right.legs[0]?.date ?? "";
    if (rank[left.status] <= 1) return leftDate.localeCompare(rightDate);
    return rightDate.localeCompare(leftDate);
  });
}

function hoursIn(months: MonthFilter, aircraftId: string): { voadas: number; previstas: number } {
  return itinerariesIn(months, aircraftId).reduce(
    (total, trip) => {
      const hours = tripHours(trip);
      total.voadas += hours.voadas;
      total.previstas += hours.previstas;
      return total;
    },
    { voadas: 0, previstas: 0 },
  );
}

export function aircraftMonth(aircraftId: string, months: MonthFilter): {
  voadas: number;
  previstas: number;
  custo: number;
} {
  const hours = hoursIn(months, aircraftId);
  const custo = expensesIn(months, aircraftId)
    .filter(eDespesaFinanceira)
    .reduce((sum, item) => sum + item.amount, 0);
  return { voadas: hours.voadas, previstas: hours.previstas, custo };
}

function centavos(value: number): number {
  return Math.round(value * 100) / 100;
}

export function listAportes(months?: MonthFilter): Aporte[] {
  return getBase()
    .aportes.filter((item) => !months || matchesMonth(item.month, months))
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}

export function getAporte(id: string): Aporte | undefined {
  return getBase().aportes.find((item) => item.id === id);
}

export function listEscalas(): FaixaEscala[] {
  return getBase().escalas;
}

export function getFaixaEscala(id: string): FaixaEscala | undefined {
  return getBase().escalas.find((item) => item.id === id);
}

/** Faixas de posse no mês/aeronave (ordem por início). */
export function escalasIn(month: string, aircraftId: string): FaixaEscala[] {
  return getBase()
    .escalas.filter(
      (item) =>
        item.month === month &&
        (aircraftId === "todas" || item.aircraftId === aircraftId),
    )
    .sort(
      (left, right) =>
        left.startDay - right.startDay ||
        left.endDay - right.endDay ||
        left.partnerId.localeCompare(right.partnerId),
    );
}

/** Sócio com posse da aeronave na data (YYYY-MM-DD), ou null se livre. */
export function posseDoDia(iso: string, aircraftId: string): string | null {
  const month = iso.slice(0, 7);
  const day = Number(iso.slice(8, 10));
  if (!month || !day) return null;
  const faixa = escalasIn(month, aircraftId).find(
    (item) => day >= item.startDay && day <= item.endDay,
  );
  return faixa?.partnerId ?? null;
}

export function faixasEscalasSobrepoem(
  left: Pick<FaixaEscala, "startDay" | "endDay">,
  right: Pick<FaixaEscala, "startDay" | "endDay">,
): boolean {
  return left.startDay <= right.endDay && right.startDay <= left.endDay;
}

export function validarFaixaEscala(item: FaixaEscala): string | null {
  if (!item.aircraftId || !item.partnerId || !/^\d{4}-\d{2}$/.test(item.month)) {
    return "Informe aeronave, sócio e mês.";
  }
  const ultimo = new Date(
    Number(item.month.slice(0, 4)),
    Number(item.month.slice(5, 7)),
    0,
  ).getDate();
  if (
    !Number.isInteger(item.startDay) ||
    !Number.isInteger(item.endDay) ||
    item.startDay < 1 ||
    item.endDay > ultimo ||
    item.startDay > item.endDay
  ) {
    return `Informe dias entre 1 e ${ultimo}, com início ≤ fim.`;
  }
  const conflito = escalasIn(item.month, item.aircraftId).find(
    (outra) => outra.id !== item.id && faixasEscalasSobrepoem(item, outra),
  );
  if (conflito) {
    return `A faixa cruza com ${partnerShort(conflito.partnerId)} (${conflito.startDay}–${conflito.endDay}).`;
  }
  return null;
}

function aplicarAportes(
  lista: Aporte[],
  aircraftId: string,
  totalRecorte: number,
  totalGeral: number,
): { pago: number; linhas: AporteAplicado[] } {
  const visiveis =
    aircraftId === "todas"
      ? lista
      : lista.filter((item) => item.aircraftId === null || item.aircraftId === aircraftId);
  if (visiveis.length === 0) return { pago: 0, linhas: [] };

  const proporcao = totalGeral > 0 ? totalRecorte / totalGeral : 0;
  const brutos = visiveis.map((item) => {
    if (aircraftId === "todas" || item.aircraftId) return item.amount;
    return item.amount * proporcao;
  });
  const alvo = centavos(brutos.reduce((soma, valor) => soma + valor, 0));
  let usado = 0;
  const linhas = visiveis.map((item, index) => {
    const aplicado =
      index === visiveis.length - 1 ? centavos(alvo - usado) : centavos(brutos[index] ?? 0);
    if (index < visiveis.length - 1) usado += aplicado;
    return {
      id: item.id,
      date: item.date,
      note: item.note,
      amount: item.amount,
      aplicado,
    };
  });
  return { pago: alvo, linhas };
}

function variation(current: number, previous: number | null): string | null {
  if (previous === null || previous === 0) return null;
  const percent = Math.round(((current - previous) / previous) * 100);
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent}% vs mês anterior`;
}

export function custosPorCategoria(months: MonthFilter, aircraftId: string): CategoryTotal[] {
  const totals = new Map<ExpenseCategory, number>();
  for (const expense of expensesIn(months, aircraftId).filter(eDespesaFinanceira)) {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
  }
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((left, right) => right.amount - left.amount);
}

function contaDoMes(months: MonthFilter, aircraftId: string): Map<string, number> {
  const totais = new Map<string, number>();
  const somar = (partnerId: string, amount: number) => {
    totais.set(partnerId, (totais.get(partnerId) ?? 0) + amount);
  };
  for (const expense of expensesIn(months, aircraftId)) {
    if (!eDespesaRateavel(expense)) continue;
    if (expense.allocation === "solicitante" && expense.partnerId) {
      somar(expense.partnerId, expense.amount);
      continue;
    }
    const craft = getAircraft(expense.aircraftId);
    if (!craft) continue;
    for (const part of splitByShare(expense.amount, craft.ownership)) {
      somar(part.partnerId, part.amount);
    }
  }
  return totais;
}

export function getRateio(months: MonthFilter, aircraftId: string): Rateio {
  const expenses = expensesIn(months, aircraftId);
  const relevantAircraft = getBase().aircraft.filter((item) =>
    matchesAircraft(item.id, aircraftId),
  );
  const partnerIds = new Set<string>();
  for (const craft of relevantAircraft) {
    for (const owner of craft.ownership) partnerIds.add(owner.partnerId);
  }

  const bucket = new Map<
    string,
    {
      participacao: number;
      voos: number;
      byAircraft: Map<string, { participacao: number; voos: number }>;
      byCategory: Map<ExpenseCategory, number>;
    }
  >();

  for (const id of partnerIds) {
    bucket.set(id, {
      participacao: 0,
      voos: 0,
      byAircraft: new Map(),
      byCategory: new Map(),
    });
  }

  const ensureAircraft = (partnerId: string, craftId: string) => {
    const row = bucket.get(partnerId);
    if (!row) return;
    if (!row.byAircraft.has(craftId)) {
      row.byAircraft.set(craftId, { participacao: 0, voos: 0 });
    }
    return row.byAircraft.get(craftId);
  };

  for (const expense of expenses) {
    // NF de abastecimento é despesa financeira da operação; o rateio vem das fatias de consumo.
    if (expense.origem === "abastecimento") continue;

    if (expense.allocation === "solicitante" && expense.partnerId) {
      const row = bucket.get(expense.partnerId);
      if (!row) continue;
      row.voos += expense.amount;
      row.byCategory.set(
        expense.category,
        (row.byCategory.get(expense.category) ?? 0) + expense.amount,
      );
      const craft = ensureAircraft(expense.partnerId, expense.aircraftId);
      if (craft) craft.voos += expense.amount;
      continue;
    }

    const craft = getAircraft(expense.aircraftId);
    if (!craft) continue;
    for (const part of splitByShare(expense.amount, craft.ownership)) {
      const row = bucket.get(part.partnerId);
      if (!row) continue;
      row.participacao += part.amount;
      row.byCategory.set(
        expense.category,
        (row.byCategory.get(expense.category) ?? 0) + part.amount,
      );
      const slice = ensureAircraft(part.partnerId, expense.aircraftId);
      if (slice) slice.participacao += part.amount;
    }
  }

  const hoursByPartner = new Map<string, Map<string, number>>();
  for (const trip of itinerariesIn(months, aircraftId)) {
    if (trip.status === "cancelado") continue;
    const hours = tripHours(trip);
    const totalHours = hours.voadas + hours.previstas;
    const map = hoursByPartner.get(trip.requestedBy) ?? new Map<string, number>();
    map.set(trip.aircraftId, (map.get(trip.aircraftId) ?? 0) + totalHours);
    hoursByPartner.set(trip.requestedBy, map);
  }

  const totaisGerais = aircraftId === "todas" ? null : contaDoMes(months, "todas");

  const partners: RateioPartner[] = [...partnerIds].map((partnerId) => {
    const row = bucket.get(partnerId);
    const participacao = row?.participacao ?? 0;
    const voos = row?.voos ?? 0;
    const total = participacao + voos;
    const geralTotal = totaisGerais?.get(partnerId) ?? total;
    const aplicado = aplicarAportes(
      getBase().aportes.filter(
        (item) => item.partnerId === partnerId && matchesMonth(item.month, months),
      ),
      aircraftId,
      total,
      aircraftId === "todas" ? total : geralTotal,
    );
    const pago = aplicado.pago;
    const saldo = centavos(total - pago);
    const hourMap = hoursByPartner.get(partnerId);
    const hours = hourMap
      ? [...hourMap.values()].reduce((sum, value) => sum + value, 0)
      : 0;

    return {
      partnerId,
      participacao,
      voos,
      total,
      pago,
      saldo,
      hours,
      byAircraft: relevantAircraft.map((craft) => {
        const slice = row?.byAircraft.get(craft.id);
        return {
          aircraftId: craft.id,
          participacao: slice?.participacao ?? 0,
          voos: slice?.voos ?? 0,
          total: (slice?.participacao ?? 0) + (slice?.voos ?? 0),
          hours: hourMap?.get(craft.id) ?? 0,
        };
      }),
      byCategory: [...(row?.byCategory.entries() ?? [])]
        .map(([category, amount]) => ({ category, amount }))
        .sort((left, right) => right.amount - left.amount),
      aportes: aplicado.linhas,
    };
  });

  partners.sort((left, right) => right.total - left.total);

  const total = partners.reduce((sum, item) => sum + item.total, 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
  const realizado = expenses
    .filter((item) => item.posting === "realizado")
    .reduce((sum, item) => sum + item.amount, 0);
  const previsto = expenses
    .filter((item) => item.posting === "previsto")
    .reduce((sum, item) => sum + item.amount, 0);
  const provisionado = expenses
    .filter((item) => item.posting === "provisionado")
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    partners,
    total,
    pago: partners.reduce((sum, item) => sum + item.pago, 0),
    saldo: partners.reduce((sum, item) => sum + item.saldo, 0),
    realizado,
    previsto,
    provisionado,
    fecha: Math.abs(total - expenseTotal) < 1,
  };
}

/** Parte do sócio em um lançamento (voo integral ou fatia da participação). */
export function valorDoParceiro(expense: Expense, partnerId: string): number {
  // NF do tanque não cabe a um sócio; a fatia de consumo (origem consumo-tanque) sim.
  if (expense.origem === "abastecimento") return 0;
  if (expense.allocation === "solicitante") {
    return expense.partnerId === partnerId ? expense.amount : 0;
  }
  const craft = getAircraft(expense.aircraftId);
  if (!craft) return 0;
  return (
    splitByShare(expense.amount, craft.ownership).find((item) => item.partnerId === partnerId)
      ?.amount ?? 0
  );
}

export type FatiaAlocacao = {
  partnerId: string;
  amount: number;
  share: number | null;
};

export type RaioXAlocacao = {
  criterio: "solicitante" | "participacao" | "sem_dono";
  regra: string;
  cruzamento: string;
  partes: FatiaAlocacao[];
};

/** Explica como a despesa foi cruzada e quanto cada sócio absorveu. */
export function raioXAlocacao(expense: Expense): RaioXAlocacao {
  const tarifa = parseTarifaPouso(expense.description);
  const trip = expense.itineraryId ? getItinerary(expense.itineraryId) : undefined;
  const leg = trip?.legs.find((item) => item.id === expense.legId);

  if (expense.origem === "abastecimento") {
    const tanque = statusTanqueAeronave(expense.aircraftId);
    return {
      criterio: "sem_dono",
      regra: "Despesa financeira da operação (tanque)",
      cruzamento: `NF de abastecimento. Voos realizados fecham o tanque pelos litros (distribuído ${formatBRL(tanque.valorDistribuido)} de ${formatBRL(tanque.valorComprado)}; saldo ${formatBRL(tanque.valorSaldo)}).`,
      partes: [],
    };
  }

  if (expense.allocation === "solicitante" && expense.partnerId) {
    const nome = partnerName(expense.partnerId);
    let cruzamento = `100% para ${nome} (quem pediu o voo).`;
    if (expense.origem === "consumo-tanque") {
      cruzamento = `Consumo do tanque na etapa ${leg ? `${leg.fromIcao}→${leg.toIcao}` : "do voo"}; cobrado de ${nome} (solicitante).`;
    } else if (tarifa && leg) {
      cruzamento = `Tarifa de pouso ${tarifa.pouso} casada com a etapa ${leg.fromIcao}→${leg.toIcao} em ${expense.date}; cobrada 100% de ${nome}.`;
    } else if (leg) {
      cruzamento = `Vinculada à etapa ${leg.fromIcao}→${leg.toIcao} (${leg.fromCity} → ${leg.toCity}); 100% de ${nome}.`;
    } else if (trip) {
      cruzamento = `Vinculada ao voo «${trip.title}»; 100% de ${nome}.`;
    }
    return {
      criterio: "solicitante",
      regra: expense.origem === "consumo-tanque" ? "Consumo do tanque · quem pediu o voo" : "Quem pediu o voo",
      cruzamento,
      partes: [{ partnerId: expense.partnerId, amount: expense.amount, share: 1 }],
    };
  }

  const craft = getAircraft(expense.aircraftId);
  if (!craft || craft.ownership.length === 0) {
    return {
      criterio: "sem_dono",
      regra: "Sem rateio",
      cruzamento: tarifa
        ? `Tarifa de pouso ${tarifa.pouso} sem etapa casada e aeronave sem participação cadastrada.`
        : "Aeronave sem participação cadastrada — valor ainda não rateado.",
      partes: [],
    };
  }

  const partes = splitByShare(expense.amount, craft.ownership).map((item) => ({
    partnerId: item.partnerId,
    amount: item.amount,
    share: craft.ownership.find((owner) => owner.partnerId === item.partnerId)?.share ?? null,
  }));
  const participacao = craft.ownership
    .map((owner) => `${partnerShort(owner.partnerId)} ${formatPercent(owner.share)}`)
    .join(" · ");
  const cruzamento = tarifa
    ? `Tarifa de pouso ${tarifa.pouso} sem voo casado → participação em ${craft.registration} (${participacao}).`
    : `Rateio pela participação em ${craft.registration}: ${participacao}.`;

  return {
    criterio: "participacao",
    regra: "Pela participação na aeronave",
    cruzamento,
    partes,
  };
}

export type PosicaoDespesas = {
  total: number;
  realizado: number;
  previsto: number;
  provisionado: number;
  categorias: CategoryTotal[];
};

/** Totais do recorte: faturado (realizado), previsto e provisionado. */
export function posicaoDespesas(
  months: MonthFilter,
  aircraftId: string,
  partnerId?: string | null,
): PosicaoDespesas {
  const totais = new Map<ExpenseCategory, number>();
  let total = 0;
  let realizado = 0;
  let previsto = 0;
  let provisionado = 0;

  for (const expense of expensesIn(months, aircraftId)) {
    // Totais financeiros usam a NF; visão do sócio usa as fatias de consumo (sem double count).
    if (partnerId) {
      if (expense.origem === "abastecimento") continue;
    } else if (expense.origem === "consumo-tanque") {
      continue;
    }
    const parte = partnerId ? valorDoParceiro(expense, partnerId) : expense.amount;
    if (parte <= 0) continue;
    total += parte;
    if (expense.posting === "realizado") realizado += parte;
    else if (expense.posting === "previsto") previsto += parte;
    else provisionado += parte;
    totais.set(expense.category, (totais.get(expense.category) ?? 0) + parte);
  }

  const categorias = [...totais.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((left, right) => right.amount - left.amount);

  return { total, realizado, previsto, provisionado, categorias };
}

export function custosDoSocio(
  months: MonthFilter,
  aircraftId: string,
  partnerId: string,
): PosicaoDespesas {
  return posicaoDespesas(months, aircraftId, partnerId);
}

function historicoDebito(expense: Expense): string {
  const registro = getAircraft(expense.aircraftId)?.registration;
  const base = registro ? `${registro} · ${expense.description}` : expense.description;
  if (expense.posting === "realizado") return base;
  return `${base} · ${POSTING_LABEL[expense.posting]}`;
}

function historicoCredito(id: string, note: string): string {
  const aporte = getAporte(id);
  const forma = aporte ? METODO_LABEL[aporte.method] : "Aporte";
  const referencia = aporte?.reference ? ` · ${aporte.reference}` : "";
  const aeronave = aporte?.aircraftId
    ? ` · ${getAircraft(aporte.aircraftId)?.registration ?? "aeronave"}`
    : "";
  const nota = note ? ` · ${note}` : "";
  return `Aporte ${forma}${referencia}${aeronave}${nota}`;
}

export function contaCorrente(
  partnerId: string,
  months: MonthFilter,
  aircraftId: string,
): ContaCorrente {
  const ativos = monthsAtivos(months);
  const primeiro = ativos ? [...ativos].sort()[0] : null;
  const anterior = centavos(
    primeiro
      ? listMonths()
          .filter((item) => item.id < primeiro)
          .reduce((soma, item) => {
            const partner = getRateio([item.id], aircraftId).partners.find(
              (row) => row.partnerId === partnerId,
            );
            return soma + (partner?.saldo ?? 0);
          }, 0)
      : 0,
  );

  const debitos = expensesIn(months, aircraftId).flatMap((expense) => {
    const valor = valorDoParceiro(expense, partnerId);
    if (valor <= 0) return [];
    return [
      {
        id: `${expense.id}-${partnerId}`,
        date: expense.date,
        historico: historicoDebito(expense),
        natureza: "debito" as const,
        valor,
      },
    ];
  });

  const creditos = (getRateio(months, aircraftId).partners.find((item) => item.partnerId === partnerId)
    ?.aportes ?? [])
    .filter((item) => item.aplicado > 0)
    .map((item) => ({
      id: item.id,
      date: item.date,
      historico: historicoCredito(item.id, item.note),
      natureza: "credito" as const,
      valor: item.aplicado,
    }));

  const movimentos = [...debitos, ...creditos].sort((left, right) => {
    const data = left.date.localeCompare(right.date);
    if (data !== 0) return data;
    if (left.natureza !== right.natureza) return left.natureza === "debito" ? -1 : 1;
    return left.id.localeCompare(right.id);
  });

  let saldo = anterior;
  const lancamentos: LancamentoConta[] = movimentos.map((item) => {
    saldo = centavos(saldo + (item.natureza === "debito" ? item.valor : -item.valor));
    return { ...item, saldo };
  });

  return {
    partnerId,
    saldoAnterior: anterior,
    debitos: centavos(debitos.reduce((soma, item) => soma + item.valor, 0)),
    creditos: centavos(creditos.reduce((soma, item) => soma + item.valor, 0)),
    saldo,
    lancamentos,
  };
}

export function getKpis(months: MonthFilter, aircraftId: string): Kpis {
  const hours = hoursIn(months, aircraftId);
  const expenses = expensesIn(months, aircraftId).filter(eDespesaFinanceira);
  const custoComprometido = expenses.reduce((sum, item) => sum + item.amount, 0);
  const custoRealizado = expenses
    .filter((item) => item.posting === "realizado")
    .reduce((sum, item) => sum + item.amount, 0);
  const variavelVoada = expenses
    .filter(
      (item) =>
        item.posting === "realizado" &&
        (item.category === "combustivel" ||
          item.category === "taxas" ||
          item.category === "handling" ||
          item.category === "catering"),
    )
    .reduce((sum, item) => sum + item.amount, 0);
  const fleet = getBase().aircraft.filter((item) => matchesAircraft(item.id, aircraftId));
  const retidas = fleet
    .filter((item) => item.status === "manutencao")
    .map((item) => item.registration);
  const rateio = getRateio(months, aircraftId);
  const ativos = monthsAtivos(months);
  const previous = ativos?.length === 1 ? previousMonth(ativos[0] ?? "") : null;
  const previousHours = previous ? hoursIn([previous], aircraftId).voadas : null;
  const previousCost = previous
    ? expensesIn([previous], aircraftId)
        .filter(eDespesaFinanceira)
        .reduce((sum, item) => sum + item.amount, 0)
    : null;

  return {
    horasVoadas: hours.voadas,
    horasPrevistas: hours.previstas,
    custoComprometido,
    custoRealizado,
    custoHora: hours.voadas > 0 ? variavelVoada / hours.voadas : null,
    prontas: fleet.length - retidas.length,
    totalAeronaves: fleet.length,
    retidas,
    saldoAberto: rateio.saldo,
    variacaoHoras: variation(hours.voadas, previousHours),
    variacaoCusto: variation(custoComprometido, previousCost),
  };
}

export function getAlertas(months: MonthFilter, aircraftId: string): Alerta[] {
  const alertas: Alerta[] = [];
  const fleet = getBase().aircraft.filter((item) => matchesAircraft(item.id, aircraftId));
  const fleetIds = new Set(fleet.map((item) => item.id));

  for (const item of getBase().maintenance) {
    if (!fleetIds.has(item.aircraftId)) continue;
    const craft = getAircraft(item.aircraftId);
    const registration = craft?.registration ?? item.aircraftId;
    if (item.grounding && item.status === "em_execucao") {
      alertas.push({
        id: `alert-${item.id}`,
        tone: "critico",
        title: `Manutenção necessária · ${registration}`,
        detail: `${item.title}. ${item.dueLabel}.`,
        href: `/manutencao/${item.id}`,
      });
      continue;
    }
    if (item.status === "em_execucao") {
      alertas.push({
        id: `alert-${item.id}`,
        tone: "atencao",
        title: `${registration} · ${item.title}`,
        detail: item.dueLabel,
        href: `/manutencao/${item.id}`,
      });
    } else if (
      item.status === "proxima" &&
      item.remainingHours !== null &&
      item.remainingHours <= 20
    ) {
      alertas.push({
        id: `alert-${item.id}`,
        tone: "atencao",
        title: `${registration} · ${item.title}`,
        detail: item.dueLabel,
        href: `/manutencao/${item.id}`,
      });
    } else if (item.dueAt && item.status === "proxima") {
      const days = daysUntil(item.dueAt, HOJE);
      if (days <= 45) {
        alertas.push({
          id: `alert-${item.id}`,
          tone: days <= 30 ? "atencao" : "info",
          title: `${registration} · ${item.title}`,
          detail: `${item.dueLabel}${item.estimate ? "" : ""}`,
          href: `/manutencao/${item.id}`,
        });
      }
    }
  }

  for (const person of getBase().crew) {
    if (!person.aircraftIds.some((id) => fleetIds.has(id))) continue;
    const dates = [
      person.medicalExpiry
        ? { label: person.medicalLabel ?? "Documento", date: person.medicalExpiry }
        : null,
      { label: person.documentLabel, date: person.documentExpiry },
    ].filter((item): item is { label: string; date: string } => item !== null);

    for (const document of dates) {
      const days = daysUntil(document.date, HOJE);
      if (days > 35) continue;
      alertas.push({
        id: `alert-crew-${person.id}-${document.date}`,
        tone: days <= 15 ? "atencao" : "info",
        title: `${person.name.split(" ")[0]} · ${document.label}`,
        detail:
          days < 0
            ? "Documento vencido."
            : `Vence em ${days} dia${days === 1 ? "" : "s"}.`,
        href: "/despesas?recorte=fixas",
      });
    }
  }

  for (const hangar of getBase().hangars) {
    if (!fleetIds.has(hangar.aircraftId)) continue;
    const days = daysUntil(hangar.contractUntil, HOJE);
    if (hangar.status === "renovacao" || days <= 90) {
      const craft = getAircraft(hangar.aircraftId);
      alertas.push({
        id: `alert-${hangar.id}`,
        tone: days <= 60 ? "atencao" : "info",
        title: `Hangar de ${craft?.registration ?? hangar.icao}`,
        detail: `${hangar.name} · contrato até ${formatDate(hangar.contractUntil)}.`,
        href: "/despesas?recorte=fixas",
      });
    }
  }

  const rateio = getRateio(months, aircraftId);
  if (rateio.saldo > 1) {
    const abertos = rateio.partners
      .filter((item) => item.saldo > 1)
      .map((item) => partnerShort(item.partnerId));
    alertas.push({
      id: "alert-rateio",
      tone: "atencao",
      title: "Rateio em aberto",
      detail: `${abertos.join(" e ")} ainda ${abertos.length > 1 ? "têm" : "tem"} saldo a aportar.`,
      href: "/rateio",
    });
  }

  const order = { critico: 0, atencao: 1, info: 2 };
  return alertas.sort((left, right) => order[left.tone] - order[right.tone]);
}

export type FaixaPainel = {
  id: string;
  registration: string;
  model: string;
  category: Aircraft["category"];
  status: Aircraft["status"];
  retida: boolean;
  fato: string;
};

export type PosicaoPainel = {
  frase: string;
  faixas: FaixaPainel[];
};

function nomeFalado(aircraft: Aircraft): string {
  if (aircraft.category === "helicoptero") return "o helicóptero";
  if (aircraft.category === "turbohelice") {
    const partes = aircraft.model.split(" ").filter((parte) => !/\d/.test(parte));
    return `o ${partes.join(" ") || "turboélice"}`;
  }
  const partes = aircraft.model.split(" ");
  const primeira = partes[0] ?? aircraft.registration;
  if (/\d/.test(primeira)) {
    const resto = partes.slice(1).join(" ");
    return resto ? `o ${resto}` : "o jato";
  }
  const nome = partes.filter((parte) => !/\d/.test(parte)).join(" ");
  return `o ${nome || primeira}`;
}

function diaDoMes(iso: string): string {
  return String(Number(iso.slice(8, 10)));
}

function comInicial(texto: string): string {
  if (!texto) return "";
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function voosAdiante(aircraftId: string, months: MonthFilter): Itinerary[] {
  return itinerariesIn(months, aircraftId)
    .filter((trip) => trip.status !== "cancelado" && trip.status !== "concluido")
    .filter((trip) => (trip.legs[0]?.date ?? "") >= HOJE)
    .sort((left, right) => {
      const data =
        (left.legs[0]?.date ?? "").localeCompare(right.legs[0]?.date ?? "");
      if (data !== 0) return data;
      return (left.legs[0]?.depart ?? "").localeCompare(right.legs[0]?.depart ?? "");
    });
}

function retencaoDe(aircraftId: string): MaintenanceItem | undefined {
  return getBase().maintenance.find(
    (item) =>
      item.aircraftId === aircraftId &&
      item.grounding &&
      item.status !== "concluida" &&
      item.status !== "em_dia",
  );
}

function fatoDaAeronave(aircraft: Aircraft, months: MonthFilter): string {
  if (aircraft.status === "em_voo") {
    const voo = getBase().itineraries.find(
      (trip) => trip.aircraftId === aircraft.id && trip.status === "em_voo",
    );
    if (!voo) return "Em voo";
    const volta = voo.legs[voo.legs.length - 1]?.date;
    return volta === HOJE ? `${voo.title}, volta hoje` : voo.title;
  }
  if (aircraft.status === "manutencao") {
    const retencao = retencaoDe(aircraft.id);
    if (retencao?.dueAt) return `Liberação prevista dia ${diaDoMes(retencao.dueAt)}`;
    return retencao?.dueLabel ?? "Em manutenção";
  }
  const proximo = voosAdiante(aircraft.id, months)[0];
  const perna = proximo?.legs[0];
  if (!proximo || !perna) return "Sem voo à frente no período";
  return `${perna.toCity}, dia ${diaDoMes(perna.date)}, ${perna.depart}`;
}

function fraseLivres(quantidade: number): string {
  const nomes = [
    "Nenhuma aeronave livre.",
    "Uma aeronave livre.",
    "Duas aeronaves livres.",
    "Três aeronaves livres.",
    "Quatro aeronaves livres.",
    "Cinco aeronaves livres.",
    "Seis aeronaves livres.",
    "Sete aeronaves livres.",
    "Oito aeronaves livres.",
    "Nove aeronaves livres.",
    "Dez aeronaves livres.",
  ];
  return nomes[quantidade] ?? `${quantidade} aeronaves livres.`;
}

export function posicaoDoPainel(
  months: MonthFilter,
  aircraftId: string,
  partnerId: string | null = null,
): PosicaoPainel {
  const frota = getBase().aircraft.filter((item) => matchesAircraft(item.id, aircraftId));
  const ordem: Record<Aircraft["status"], number> = {
    em_voo: 0,
    disponivel: 1,
    manutencao: 2,
  };
  const faixas = [...frota]
    .sort(
      (left, right) =>
        ordem[left.status] - ordem[right.status] ||
        left.registration.localeCompare(right.registration),
    )
    .map((aircraft) => ({
      id: aircraft.id,
      registration: aircraft.registration,
      model: aircraft.model,
      category: aircraft.category,
      status: aircraft.status,
      retida: aircraft.status === "manutencao" && Boolean(retencaoDe(aircraft.id)),
      fato: fatoDaAeronave(aircraft, months),
    }));

  const partes = [fraseLivres(frota.filter((item) => item.status !== "manutencao").length)];

  const proximoLivre = frota
    .filter((item) => item.status === "disponivel")
    .map((aircraft) => ({ aircraft, trip: voosAdiante(aircraft.id, months)[0] }))
    .filter((item): item is { aircraft: Aircraft; trip: Itinerary } => Boolean(item.trip))
    .sort((left, right) =>
      (left.trip.legs[0]?.date ?? "").localeCompare(right.trip.legs[0]?.date ?? ""),
    )[0];
  if (proximoLivre?.trip.legs[0]) {
    const perna = proximoLivre.trip.legs[0];
    partes.push(
      comInicial(
        `${nomeFalado(proximoLivre.aircraft)} voa para ${perna.toCity} dia ${diaDoMes(perna.date)}.`,
      ),
    );
  } else {
    const noAr = frota.find((item) => item.status === "em_voo");
    const voo = noAr
      ? getBase().itineraries.find(
          (trip) => trip.aircraftId === noAr.id && trip.status === "em_voo",
        )
      : undefined;
    const noPeriodo =
      voo?.legs.some((leg) => matchesMonth(leg.date.slice(0, 7), months)) ?? false;
    if (noAr && noPeriodo) partes.push(comInicial(`${nomeFalado(noAr)} está no ar.`));
  }

  const volta = frota
    .filter((item) => item.status === "manutencao")
    .map((aircraft) => ({ aircraft, trip: voosAdiante(aircraft.id, months)[0] }))
    .filter((item): item is { aircraft: Aircraft; trip: Itinerary } => Boolean(item.trip))
    .sort((left, right) =>
      (left.trip.legs[0]?.date ?? "").localeCompare(right.trip.legs[0]?.date ?? ""),
    )[0];
  if (volta?.trip.legs[0]) {
    partes.push(
      comInicial(
        `${nomeFalado(volta.aircraft)} volta dia ${diaDoMes(volta.trip.legs[0].date)}.`,
      ),
    );
  }

  const kpis = getKpis(months, aircraftId);
  const rateio = getRateio(months, aircraftId);
  const eu = partnerId
    ? rateio.partners.find((item) => item.partnerId === partnerId)
    : undefined;
  const ativosPainel = monthsAtivos(months);
  const periodo = !ativosPainel || ativosPainel.length > 1 ? "O período" : "O mês";
  const custo = `${periodo} está em ${formatMil(kpis.custoComprometido)}`;
  if (eu) {
    if (eu.saldo <= 1) partes.push(`${custo} e o seu aporte está em dia.`);
    else partes.push(`${custo} e você ainda aporta ${formatMil(eu.saldo)}.`);
  } else if (rateio.saldo <= 1) {
    partes.push(`${custo} e o rateio dos sócios está em dia.`);
  } else {
    partes.push(`${custo} e ainda faltam ${formatMil(rateio.saldo)} no rateio.`);
  }

  return {
    frase: `${monthsLabel(months)}. ${partes.join(" ")}`,
    faixas,
  };
}

export function crewOnAircraft(aircraftId: string): CrewMember[] {
  return getBase().crew.filter((person) => person.aircraftIds.includes(aircraftId));
}

export function maintenanceOf(aircraftId: string): MaintenanceItem[] {
  return getBase().maintenance.filter((item) => item.aircraftId === aircraftId);
}
