"use client";

import { useSyncExternalStore } from "react";
import {
  getBase,
  getErroBanco,
  getPronto,
  getServerBase,
  subscribeDados,
  type BaseDados,
} from "@/services/dados";

export function useDados(): BaseDados {
  return useSyncExternalStore(subscribeDados, getBase, getServerBase);
}

export function usePronto(): boolean {
  return useSyncExternalStore(subscribeDados, getPronto, () => false);
}

export function useErroBanco(): string | null {
  return useSyncExternalStore(subscribeDados, getErroBanco, () => null);
}
