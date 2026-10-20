import { getBase, novoId, updateBase } from "@/services/dados";
import type {
  Aircraft,
  CrewMember,
  Expense,
  Hangar,
  Insurance,
  Itinerary,
  Aporte,
  MaintenanceItem,
  Partner,
  Rota,
} from "@/types/operacao";

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index < 0) return [...list, item];
  const next = [...list];
  next[index] = item;
  return next;
}

export function salvarRota(item: Rota): void {
  updateBase((atual) => ({ ...atual, rotas: upsert(atual.rotas, item) }));
}

export function excluirRota(id: string): void {
  updateBase((atual) => ({ ...atual, rotas: atual.rotas.filter((item) => item.id !== id) }));
}

export function salvarSocio(item: Partner): void {
  updateBase((atual) => ({ ...atual, partners: upsert(atual.partners, item) }));
}

export function excluirSocio(id: string): string | null {
  const atual = getBase();
  const aeronaves = atual.aircraft
    .filter((item) => item.ownership.some((owner) => owner.partnerId === id && owner.share > 0))
    .map((item) => item.registration);
  if (aeronaves.length > 0) {
    return `Este cotista ainda tem participação em ${aeronaves.join(", ")}. Ajuste a frota antes de excluir.`;
  }
  if (atual.aportes.some((item) => item.partnerId === id)) {
    return "Este cotista tem aportes lançados. Exclua os aportes antes.";
  }
  if (atual.itineraries.some((item) => item.requestedBy === id)) {
    return "Este cotista pediu itinerários. Ajuste os voos antes de excluir.";
  }
  if (atual.extras.some((item) => item.partnerId === id)) {
    return "Este cotista está em despesas. Ajuste as despesas antes de excluir.";
  }
  updateBase((base) => ({
    ...base,
    partners: base.partners.filter((item) => item.id !== id),
    aircraft: base.aircraft.map((item) => ({
      ...item,
      ownership: item.ownership.filter((owner) => owner.partnerId !== id),
    })),
  }));
  return null;
}

export function salvarAeronave(item: Aircraft, seguro: Insurance): void {
  updateBase((atual) => ({
    ...atual,
    aircraft: upsert(atual.aircraft, item),
    seguros: upsertSeguro(atual.seguros, seguro),
  }));
}

function upsertSeguro(list: Insurance[], item: Insurance): Insurance[] {
  const index = list.findIndex((entry) => entry.aircraftId === item.aircraftId);
  if (item.amount <= 0) {
    return list.filter((entry) => entry.aircraftId !== item.aircraftId);
  }
  if (index < 0) return [...list, item];
  const next = [...list];
  next[index] = item;
  return next;
}

export function excluirAeronave(id: string): void {
  updateBase((atual) => ({
    ...atual,
    aircraft: atual.aircraft.filter((item) => item.id !== id),
    seguros: atual.seguros.filter((item) => item.aircraftId !== id),
    hangars: atual.hangars.filter((item) => item.aircraftId !== id),
    itineraries: atual.itineraries.filter((item) => item.aircraftId !== id),
    maintenance: atual.maintenance.filter((item) => item.aircraftId !== id),
    extras: atual.extras.filter((item) => item.aircraftId !== id),
    aportes: atual.aportes.filter((item) => item.aircraftId !== id),
    crew: atual.crew.map((person) => ({
      ...person,
      aircraftIds: person.aircraftIds.filter((aircraftId) => aircraftId !== id),
    })),
  }));
}

export function salvarItinerario(item: Itinerary): void {
  updateBase((atual) => ({ ...atual, itineraries: upsert(atual.itineraries, item) }));
}

export function excluirItinerario(id: string): void {
  updateBase((atual) => ({
    ...atual,
    itineraries: atual.itineraries.filter((item) => item.id !== id),
  }));
}

export function salvarTripulante(item: CrewMember): void {
  updateBase((atual) => ({ ...atual, crew: upsert(atual.crew, item) }));
}

export function excluirTripulante(id: string): void {
  updateBase((atual) => ({
    ...atual,
    crew: atual.crew.filter((item) => item.id !== id),
  }));
}

export function salvarHangar(item: Hangar): void {
  updateBase((atual) => ({ ...atual, hangars: upsert(atual.hangars, item) }));
}

export function excluirHangar(id: string): void {
  updateBase((atual) => ({
    ...atual,
    hangars: atual.hangars.filter((item) => item.id !== id),
  }));
}

export function salvarManutencao(item: MaintenanceItem): void {
  updateBase((atual) => ({ ...atual, maintenance: upsert(atual.maintenance, item) }));
}

export function excluirManutencao(id: string): void {
  updateBase((atual) => ({
    ...atual,
    maintenance: atual.maintenance.filter((item) => item.id !== id),
  }));
}

export function salvarDespesa(item: Expense): void {
  updateBase((atual) => ({
    ...atual,
    extras: upsert(atual.extras, { ...item, manual: true }),
  }));
}

export function excluirDespesa(id: string): void {
  updateBase((atual) => ({
    ...atual,
    extras: atual.extras.filter((item) => item.id !== id),
  }));
}

export function salvarAporte(item: Aporte): void {
  updateBase((atual) => ({ ...atual, aportes: upsert(atual.aportes, item) }));
}

export function excluirAporte(id: string): void {
  updateBase((atual) => ({
    ...atual,
    aportes: atual.aportes.filter((item) => item.id !== id),
  }));
}

export function criarId(prefix: string): string {
  return novoId(prefix);
}
