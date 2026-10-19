import { HOJE, MONTHS, VIEWER_ID } from "@/data/calendario";
import { getBase } from "@/services/dados";
import { daysUntil, formatDate, formatMil } from "@/lib/format";
import { METODO_LABEL, POSTING_LABEL, ROLE_LABEL } from "@/lib/labels";
import type {
  Aircraft,
  Alerta,
  Aporte,
  AporteAplicado,
  CategoryTotal,
  ContaCorrente,
  CrewMember,
  Expense,
  ExpenseCategory,
  Hangar,
  Insurance,
  Itinerary,
  Kpis,
  LancamentoConta,
  Leg,
  MaintenanceItem,
  Partner,
  Posting,
  Rateio,
  RateioPartner,
} from "@/types/operacao";

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

export function listItinerarySource(): Itinerary[] {
  return getBase().itineraries;
}

export function getItinerary(id: string): Itinerary | undefined {
  return getBase().itineraries.find((item) => item.id === id);
}

export function getDespesaManual(id: string): Expense | undefined {
  return getBase().extras.find((item) => item.id === id);
}

export function seguroDe(aircraftId: string): Insurance | undefined {
  return getBase().seguros.find((item) => item.aircraftId === aircraftId);
}

export function hrefOrigem(expense: Expense): string {
  if (expense.manual) return `/despesas/${expense.id}/editar`;
  if (expense.itineraryId) return `/itinerarios/${expense.itineraryId}/editar`;
  if (expense.maintenanceId) return `/manutencao/${expense.maintenanceId}/editar`;
  if (expense.hangarId) return `/hangar/${expense.hangarId}/editar`;
  if (expense.crewId) return `/pessoal/${expense.crewId}/editar`;
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

export function itineraryCities(trip: Itinerary): string {
  const first = trip.legs[0];
  if (!first) return "";
  const cities = [first.fromCity, ...trip.legs.map((leg) => leg.toCity)];
  const compact: string[] = [];
  for (const city of cities) {
    if (compact[compact.length - 1] !== city) compact.push(city);
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
      const parts = splitEqual(person.monthlyCost, person.aircraftIds.length);
      person.aircraftIds.forEach((aircraftId, index) => {
        const amount = parts[index] ?? 0;
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
    for (const leg of trip.legs) {
      const posting = legPosting(leg, trip);
      const month = leg.date.slice(0, 7);
      const items: Array<{
        category: ExpenseCategory;
        amount: number;
        description: string;
      }> = [
        {
          category: "combustivel",
          amount: leg.fuel,
          description: `Combustível · ${leg.fromIcao} → ${leg.toIcao}`,
        },
        {
          category: "taxas",
          amount: leg.fees,
          description: `Taxas · ${leg.toCity}`,
        },
        {
          category: "handling",
          amount: leg.handling,
          description: `Pátio · ${leg.toCity}`,
        },
        {
          category: "catering",
          amount: leg.catering,
          description: `Catering · ${leg.fromCity} → ${leg.toCity}`,
        },
      ];

      for (const item of items) {
        if (item.amount <= 0) continue;
        const vendorKey = item.category;
        if (
          vendorKey !== "combustivel" &&
          vendorKey !== "taxas" &&
          vendorKey !== "handling" &&
          vendorKey !== "catering"
        ) {
          continue;
        }
        expenses.push({
          id: `${leg.id}-${item.category}`,
          aircraftId: trip.aircraftId,
          itineraryId: trip.id,
          legId: leg.id,
          month,
          date: leg.date,
          category: item.category,
          description: item.description,
          vendor: VENDORS[vendorKey],
          amount: item.amount,
          allocation: "solicitante",
          partnerId: trip.requestedBy,
          posting,
        });
      }
    }
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

export function listExpenses(): Expense[] {
  return [...buildExpenses(), ...getBase().extras];
}

export function expensesIn(month: string, aircraftId: string): Expense[] {
  return listExpenses().filter(
    (item) => item.month === month && matchesAircraft(item.aircraftId, aircraftId),
  );
}

export function expensesOfItinerary(itineraryId: string): Expense[] {
  return listExpenses().filter((item) => item.itineraryId === itineraryId);
}

export function itinerariesIn(month: string, aircraftId: string): Itinerary[] {
  return getBase().itineraries.filter((trip) => {
    if (!matchesAircraft(trip.aircraftId, aircraftId)) return false;
    return trip.legs.some((leg) => leg.date.startsWith(month));
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

function hoursIn(month: string, aircraftId: string): { voadas: number; previstas: number } {
  return itinerariesIn(month, aircraftId).reduce(
    (total, trip) => {
      const hours = tripHours(trip);
      total.voadas += hours.voadas;
      total.previstas += hours.previstas;
      return total;
    },
    { voadas: 0, previstas: 0 },
  );
}

export function aircraftMonth(aircraftId: string, month: string): {
  voadas: number;
  previstas: number;
  custo: number;
} {
  const hours = hoursIn(month, aircraftId);
  const custo = expensesIn(month, aircraftId).reduce((sum, item) => sum + item.amount, 0);
  return { voadas: hours.voadas, previstas: hours.previstas, custo };
}

function centavos(value: number): number {
  return Math.round(value * 100) / 100;
}

export function listAportes(month?: string): Aporte[] {
  return getBase()
    .aportes.filter((item) => !month || item.month === month)
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}

export function getAporte(id: string): Aporte | undefined {
  return getBase().aportes.find((item) => item.id === id);
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

export function custosPorCategoria(month: string, aircraftId: string): CategoryTotal[] {
  const totals = new Map<ExpenseCategory, number>();
  for (const expense of expensesIn(month, aircraftId)) {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
  }
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((left, right) => right.amount - left.amount);
}

function contaDoMes(month: string, aircraftId: string): Map<string, number> {
  const totais = new Map<string, number>();
  const somar = (partnerId: string, amount: number) => {
    totais.set(partnerId, (totais.get(partnerId) ?? 0) + amount);
  };
  for (const expense of expensesIn(month, aircraftId)) {
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

export function getRateio(month: string, aircraftId: string): Rateio {
  const expenses = expensesIn(month, aircraftId);
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
  for (const trip of itinerariesIn(month, aircraftId)) {
    if (trip.status === "cancelado") continue;
    const hours = tripHours(trip);
    const totalHours = hours.voadas + hours.previstas;
    const map = hoursByPartner.get(trip.requestedBy) ?? new Map<string, number>();
    map.set(trip.aircraftId, (map.get(trip.aircraftId) ?? 0) + totalHours);
    hoursByPartner.set(trip.requestedBy, map);
  }

  const totaisGerais = aircraftId === "todas" ? null : contaDoMes(month, "todas");

  const partners: RateioPartner[] = [...partnerIds].map((partnerId) => {
    const row = bucket.get(partnerId);
    const participacao = row?.participacao ?? 0;
    const voos = row?.voos ?? 0;
    const total = participacao + voos;
    const geralTotal = totaisGerais?.get(partnerId) ?? total;
    const aplicado = aplicarAportes(
      getBase().aportes.filter((item) => item.partnerId === partnerId && item.month === month),
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

function valorDoParceiro(expense: Expense, partnerId: string): number {
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

export function contaCorrente(partnerId: string, month: string, aircraftId: string): ContaCorrente {
  const anterior = centavos(
    listMonths()
      .filter((item) => item.id < month)
      .reduce((soma, item) => {
        const partner = getRateio(item.id, aircraftId).partners.find(
          (row) => row.partnerId === partnerId,
        );
        return soma + (partner?.saldo ?? 0);
      }, 0),
  );

  const debitos = expensesIn(month, aircraftId).flatMap((expense) => {
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

  const creditos = (getRateio(month, aircraftId).partners.find((item) => item.partnerId === partnerId)
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

export function getKpis(month: string, aircraftId: string): Kpis {
  const hours = hoursIn(month, aircraftId);
  const expenses = expensesIn(month, aircraftId);
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
  const rateio = getRateio(month, aircraftId);
  const previous = previousMonth(month);
  const previousHours = previous ? hoursIn(previous, aircraftId).voadas : null;
  const previousCost = previous
    ? expensesIn(previous, aircraftId).reduce((sum, item) => sum + item.amount, 0)
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

export function getAlertas(month: string, aircraftId: string): Alerta[] {
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
        title: `${registration} retido`,
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
        href: "/pessoal",
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
        href: "/hangar",
      });
    }
  }

  const rateio = getRateio(month, aircraftId);
  if (rateio.saldo > 1) {
    const abertos = rateio.partners
      .filter((item) => item.saldo > 1)
      .map((item) => partnerShort(item.partnerId));
    alertas.push({
      id: "alert-rateio",
      tone: "atencao",
      title: "Rateio do mês em aberto",
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

function voosAdiante(aircraftId: string, month: string): Itinerary[] {
  return itinerariesIn(month, aircraftId)
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

function fatoDaAeronave(aircraft: Aircraft, month: string): string {
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
  const proximo = voosAdiante(aircraft.id, month)[0];
  const perna = proximo?.legs[0];
  if (!proximo || !perna) return "Sem voo à frente neste mês";
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

export function posicaoDoPainel(month: string, aircraftId: string): PosicaoPainel {
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
      fato: fatoDaAeronave(aircraft, month),
    }));

  const partes = [fraseLivres(frota.filter((item) => item.status !== "manutencao").length)];

  const proximoLivre = frota
    .filter((item) => item.status === "disponivel")
    .map((aircraft) => ({ aircraft, trip: voosAdiante(aircraft.id, month)[0] }))
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
    const noMes = voo?.legs.some((leg) => leg.date.startsWith(month)) ?? false;
    if (noAr && noMes) partes.push(comInicial(`${nomeFalado(noAr)} está no ar.`));
  }

  const volta = frota
    .filter((item) => item.status === "manutencao")
    .map((aircraft) => ({ aircraft, trip: voosAdiante(aircraft.id, month)[0] }))
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

  const kpis = getKpis(month, aircraftId);
  const rateio = getRateio(month, aircraftId);
  const eu = rateio.partners.find((item) => item.partnerId === VIEWER_ID);
  const custo = `O mês está em ${formatMil(kpis.custoComprometido)}`;
  if (!eu) partes.push(`${custo}.`);
  else if (eu.saldo <= 1) partes.push(`${custo} e o seu aporte está em dia.`);
  else partes.push(`${custo} e você ainda aporta ${formatMil(eu.saldo)}.`);

  return {
    frase: `${monthShort(month)}. ${partes.join(" ")}`,
    faixas,
  };
}

export function crewOnAircraft(aircraftId: string): CrewMember[] {
  return getBase().crew.filter((person) => person.aircraftIds.includes(aircraftId));
}

export function maintenanceOf(aircraftId: string): MaintenanceItem[] {
  return getBase().maintenance.filter((item) => item.aircraftId === aircraftId);
}
