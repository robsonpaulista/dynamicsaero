import {
  AERODROMOS_SEED,
  AIRCRAFT,
  APORTES,
  CONTAS,
  CREW,
  ESCALAS,
  EXTRAS,
  HANGARS,
  ITINERARIES,
  MAINTENANCE,
  PARTNERS,
  ROTAS,
  SEED_OPERACAO,
  SEGUROS,
} from "@/data/caso-real";
import type { Aerodromo } from "@/data/aerodromos";
import { mesclarContasPlano } from "@/data/plano-contas";
import { carregarOperacao, gravarOperacao } from "@/services/banco";
import type {
  Aircraft,
  Aporte,
  ContaPlano,
  CrewMember,
  Expense,
  FaixaEscala,
  Hangar,
  Insurance,
  Itinerary,
  MaintenanceItem,
  AlocacaoVibra,
  Partner,
  Rota,
} from "@/types/operacao";

/** Mesmo valor usado no rateio histórico de combustível (PS-JSA · 74 gal/h). */
const CONSUMO_COMBUSTIVEL_PADRAO_GPH = 74;

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
  escalas: FaixaEscala[];
  rotas: Rota[];
  contas: ContaPlano[];
  /** Aeródromos cadastrados na operação (além do catálogo estático). */
  aerodromos: Aerodromo[];
  /** Alocação manual Vibra: trecho → comprovante. */
  alocacoesVibra: AlocacaoVibra[];
};

export const INITIAL_BASE: BaseDados = {
  aircraft: AIRCRAFT,
  partners: PARTNERS,
  crew: CREW,
  hangars: HANGARS,
  seguros: SEGUROS,
  itineraries: ITINERARIES,
  maintenance: MAINTENANCE,
  extras: EXTRAS,
  aportes: APORTES,
  escalas: ESCALAS,
  rotas: ROTAS,
  contas: CONTAS,
  aerodromos: AERODROMOS_SEED,
  alocacoesVibra: [],
};

const STORAGE_KEY = "dynamics-aero-dados-v1";
const SEED_KEY = "dynamics-aero-seed-v1";
const ALOCACOES_VIBRA_KEY = "dynamics-aero-alocacoes-vibra-v1";

let current: BaseDados = INITIAL_BASE;
let hidratado = false;
let carregando = false;
let erroBanco: string | null = null;
let geracao = 0;
const pendenciasAntesHidratacao: Array<(atual: BaseDados) => BaseDados> = [];
const listeners = new Set<() => void>();

function salvarAlocacoesLocais(alocacoes: AlocacaoVibra[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ALOCACOES_VIBRA_KEY, JSON.stringify(alocacoes));
  } catch {
    // ignore quota / private mode
  }
}

function lerAlocacoesLocais(): AlocacaoVibra[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(ALOCACOES_VIBRA_KEY);
    if (!bruto) return [];
    const parsed: unknown = JSON.parse(bruto);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (typeof item !== "object" || item === null) return null;
        const registro = item as Record<string, unknown>;
        const legId = String(registro.legId ?? "").trim();
        const abastecimentoId = String(registro.abastecimentoId ?? "").trim();
        if (!legId || !abastecimentoId) return null;
        return { legId, abastecimentoId };
      })
      .filter((item): item is AlocacaoVibra => item != null);
  } catch {
    return [];
  }
}

function mesclarAlocacoes(
  primario: AlocacaoVibra[] | undefined,
  secundario: AlocacaoVibra[] | undefined,
): AlocacaoVibra[] {
  const mapa = new Map<string, AlocacaoVibra>();
  for (const item of secundario ?? []) mapa.set(item.legId, item);
  for (const item of primario ?? []) mapa.set(item.legId, item);
  return [...mapa.values()];
}

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
  salvarAlocacoesLocais(next.alocacoesVibra ?? []);
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
  if (!hidratado) {
    pendenciasAntesHidratacao.push(recipe);
    current = recipe(current);
    salvarAlocacoesLocais(current.alocacoesVibra ?? []);
    emit();
    return;
  }
  current = recipe(current);
  persistir(current);
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
  const escalas = asArray<FaixaEscala>(parsed.escalas) ?? [];
  const rotas = asArray<Rota>(parsed.rotas) ?? [];
  const contas = mesclarContasPlano(asArray<ContaPlano>(parsed.contas));
  const aerodromos = (asArray<Aerodromo>(parsed.aerodromos) ?? [])
    .map((item) => ({
      icao: String(item.icao ?? "")
        .trim()
        .toUpperCase(),
      cidade: String(item.cidade ?? "").trim(),
    }))
    .filter((item) => item.icao && item.cidade);
  const alocacoesVibra = (asArray<AlocacaoVibra>(parsed.alocacoesVibra) ?? [])
    .map((item) => ({
      legId: String(item.legId ?? "").trim(),
      abastecimentoId: String(item.abastecimentoId ?? "").trim(),
    }))
    .filter((item) => item.legId && item.abastecimentoId);
  if (!aircraft || !partners || !crew || !hangars || !seguros || !itineraries || !maintenance) {
    return null;
  }
  return {
    aircraft: aircraft.map(normalizarAeronave),
    partners,
    crew,
    hangars,
    seguros,
    itineraries,
    maintenance,
    extras,
    aportes,
    escalas,
    rotas,
    contas,
    aerodromos,
    alocacoesVibra,
  };
}

function normalizarAeronave(item: Aircraft): Aircraft {
  const consumo = item.fuelBurnGph;
  if (typeof consumo === "number" && consumo > 0) return item;
  return { ...item, fuelBurnGph: CONSUMO_COMBUSTIVEL_PADRAO_GPH };
}

export async function hidratarBanco(): Promise<void> {
  if (typeof window === "undefined" || hidratado || carregando) return;
  carregando = true;
  try {
    const seedAtual = window.localStorage.getItem(SEED_KEY);
    const seedNovo = seedAtual !== SEED_OPERACAO;
    const remotoBruto = await carregarOperacao().catch(() => null);
    const remoto = remotoBruto != null ? lerBase(remotoBruto) : null;

    const alocacoesLocais = lerAlocacoesLocais();
    if (seedNovo) {
      // Novo seed de dados (itinerários etc.), mas preserva alocações manuais Vibra.
      const alocacoesPreservadas = mesclarAlocacoes(remoto?.alocacoesVibra, alocacoesLocais);
      current = {
        ...INITIAL_BASE,
        alocacoesVibra: alocacoesPreservadas,
      };
      salvarAlocacoesLocais(alocacoesPreservadas);
      await gravarOperacao(current);
      window.localStorage.setItem(SEED_KEY, SEED_OPERACAO);
    } else if (remoto && remoto.aircraft.length > 0) {
      const alocacoesMescladas = mesclarAlocacoes(remoto.alocacoesVibra, alocacoesLocais);
      current = {
        ...remoto,
        alocacoesVibra: alocacoesMescladas,
      };
      const remotoSerial = JSON.stringify(remoto.alocacoesVibra ?? []);
      const mescladoSerial = JSON.stringify(alocacoesMescladas);
      if (mescladoSerial !== remotoSerial) {
        await gravarOperacao(current);
      }
      salvarAlocacoesLocais(alocacoesMescladas);
    } else {
      current = {
        ...INITIAL_BASE,
        alocacoesVibra: alocacoesLocais,
      };
      salvarAlocacoesLocais(alocacoesLocais);
      await gravarOperacao(current);
    }

    if (pendenciasAntesHidratacao.length > 0) {
      for (const recipe of pendenciasAntesHidratacao.splice(0)) {
        current = recipe(current);
      }
      salvarAlocacoesLocais(current.alocacoesVibra ?? []);
      await gravarOperacao(current);
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
    window.localStorage.removeItem(ALOCACOES_VIBRA_KEY);
    window.localStorage.setItem(SEED_KEY, SEED_OPERACAO);
  }
  hidratado = true;
  persistir(current);
  emit();
}

export function novoId(prefix: string): string {
  const token = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${token}`;
}
