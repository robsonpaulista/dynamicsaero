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
};

const STORAGE_KEY = "dynamics-aero-dados-v1";

let current: BaseDados = INITIAL_BASE;
let hidratado = false;
const listeners = new Set<() => void>();

export function getPronto(): boolean {
  return hidratado;
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

function persist(next: BaseDados): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function updateBase(recipe: (atual: BaseDados) => BaseDados): void {
  current = recipe(current);
  persist(current);
  emit();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asArray<T>(value: unknown): T[] | null {
  return Array.isArray(value) ? (value as T[]) : null;
}

export function hidratarLocal(): void {
  if (typeof window === "undefined" || hidratado) return;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed)) {
        const aircraft = asArray<Aircraft>(parsed.aircraft);
        const partners = asArray<Partner>(parsed.partners);
        const crew = asArray<CrewMember>(parsed.crew);
        const hangars = asArray<Hangar>(parsed.hangars);
        const seguros = asArray<Insurance>(parsed.seguros);
        const itineraries = asArray<Itinerary>(parsed.itineraries);
        const maintenance = asArray<MaintenanceItem>(parsed.maintenance);
        const extras = asArray<Expense>(parsed.extras) ?? [];
        const aportes = asArray<Aporte>(parsed.aportes) ?? APORTES;
        if (aircraft && partners && crew && hangars && seguros && itineraries && maintenance) {
          current = {
            aircraft,
            partners: partners.map((item) => ({
              ...item,
              phone: item.phone || PARTNERS.find((origem) => origem.id === item.id)?.phone || "",
            })),
            crew,
            hangars,
            seguros,
            itineraries,
            maintenance,
            extras,
            aportes,
          };
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
  hidratado = true;
  emit();
}

export function restaurarDemonstracao(): void {
  current = INITIAL_BASE;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  emit();
}

export function novoId(prefix: string): string {
  const token = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${token}`;
}
