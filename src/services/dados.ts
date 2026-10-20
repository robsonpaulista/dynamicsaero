import { APORTES } from "@/data/aportes";
import {
  AIRCRAFT,
  CREW,
  HANGARS,
  ITINERARIES,
  MAINTENANCE,
  PARTNERS,
  SEGUROS,
} from "@/data/mock";
import { carregarOperacao, gravarOperacao } from "@/services/banco";
import type {
  Aircraft,
  Aporte,
  CrewMember,
  Expense,
  Hangar,
  Insurance,
  Itinerary,
  MaintenanceItem,
  Partner,
  Rota,
} from "@/types/operacao";

export type BaseDados = {
  aircraft: Aircraft[];
  partners: Partner[];
  crew: CrewMember[];
  hangars: Hangar[];
  seguros: Insurance[];
  itineraries: Itinerary[];
  maintenance: MaintenanceItem[];
  extras: Expense[];
  aportes: Aporte[];
  rotas: Rota[];
};

export const INITIAL_BASE: BaseDados = {
  aircraft: AIRCRAFT,
  partners: PARTNERS,
  crew: CREW,
  hangars: HANGARS,
  seguros: SEGUROS,
  itineraries: ITINERARIES,
  maintenance: MAINTENANCE,
  extras: [],
  aportes: APORTES,
  rotas: rotasDaDemonstracao(),
};

function rotasDaDemonstracao(): Rota[] {
  const vistas = new Map<string, Rota>();
  for (const voo of ITINERARIES) {
    for (const perna of voo.legs) {
      const id = `${perna.fromIcao}-${perna.toIcao}`.toLowerCase();
      if (vistas.has(id)) continue;
      vistas.set(id, {
        id,
        nome: `${perna.fromCity} → ${perna.toCity}`,
        fromIcao: perna.fromIcao,
        toIcao: perna.toIcao,
        fromCity: perna.fromCity,
        toCity: perna.toCity,
        blockHours: perna.blockHours,
        note: "",
      });
    }
  }
  return [...vistas.values()];
}

const STORAGE_KEY = "dynamics-aero-dados-v1";

let current: BaseDados = INITIAL_BASE;
let hidratado = false;
let carregando = false;
let erroBanco: string | null = null;
let geracao = 0;
const listeners = new Set<() => void>();

export function getPronto(): boolean {
  return hidratado;
}

export function getErroBanco(): string | null {
  return erroBanco;
}

export function getBase(): BaseDados {
  return current;
}

export function getServerBase(): BaseDados {
  return INITIAL_BASE;
}

export function subscribeDados(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function mensagem(error: unknown): string {
  return error instanceof Error ? error.message : "Falha ao falar com o banco.";
}

function persistir(next: BaseDados): void {
  const marca = ++geracao;
  void gravarOperacao(next)
    .then(() => {
      if (marca !== geracao) return;
      erroBanco = null;
      emit();
    })
    .catch((error: unknown) => {
      if (marca !== geracao) return;
      erroBanco = mensagem(error);
      emit();
    });
}

export function updateBase(recipe: (atual: BaseDados) => BaseDados): void {
  current = recipe(current);
  if (hidratado) persistir(current);
  emit();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asArray<T>(value: unknown): T[] | null {
  return Array.isArray(value) ? (value as T[]) : null;
}

function lerBase(parsed: unknown): BaseDados | null {
  if (!isRecord(parsed)) return null;
  const aircraft = asArray<Aircraft>(parsed.aircraft);
  const partners = asArray<Partner>(parsed.partners);
  const crew = asArray<CrewMember>(parsed.crew);
  const hangars = asArray<Hangar>(parsed.hangars);
  const seguros = asArray<Insurance>(parsed.seguros);
  const itineraries = asArray<Itinerary>(parsed.itineraries);
  const maintenance = asArray<MaintenanceItem>(parsed.maintenance);
  const extras = asArray<Expense>(parsed.extras) ?? [];
  const aportes = asArray<Aporte>(parsed.aportes) ?? [];
  const rotas = asArray<Rota>(parsed.rotas) ?? [];
  if (!aircraft || !partners || !crew || !hangars || !seguros || !itineraries || !maintenance) {
    return null;
  }
  return {
    aircraft,
    partners,
    crew,
    hangars,
    seguros,
    itineraries,
    maintenance,
    extras,
    aportes,
    rotas,
  };
}

export async function hidratarBanco(): Promise<void> {
  if (typeof window === "undefined" || hidratado || carregando) return;
  carregando = true;
  try {
    const remoto = lerBase(await carregarOperacao());
    if (remoto && remoto.aircraft.length > 0) {
      current = remoto;
    } else {
      current = INITIAL_BASE;
      await gravarOperacao(INITIAL_BASE);
    }
    erroBanco = null;
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error: unknown) {
    erroBanco = mensagem(error);
  }
  carregando = false;
  hidratado = true;
  emit();
}

export function restaurarDemonstracao(): void {
  current = INITIAL_BASE;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  hidratado = true;
  persistir(current);
  emit();
}

export function novoId(prefix: string): string {
  const token = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${token}`;
}
