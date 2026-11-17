import { ABASTECIMENTOS_VIBRA } from "@/data/caso-real";
import { getBase, updateBase } from "@/services/dados";
import { litrosConsumidosTrecho, matchesAircraft } from "@/services/operacao";

export type ResultadoAlocacaoVibra =
  | { ok: true }
  | { ok: false; motivo: string };

type TrechoOrigem = {
  legId: string;
  date: string;
  fromIcao: string;
  ordem: number;
};

function listarTrechosOrigem(aircraftFilter = "psjsa"): TrechoOrigem[] {
  const trechos: TrechoOrigem[] = [];
  for (const trip of getBase().itineraries) {
    if (trip.status === "cancelado") continue;
    if (!matchesAircraft(trip.aircraftId, aircraftFilter)) continue;
    for (const leg of trip.legs) {
      const litros = litrosConsumidosTrecho(trip.aircraftId, leg.blockHours);
      if (!(leg.blockHours > 0) && !(litros > 0)) continue;
      trechos.push({
        legId: leg.id,
        date: leg.date,
        fromIcao: leg.fromIcao,
        ordem: leg.ordem ?? (Number.parseInt(leg.id.replace(/\D+/g, ""), 10) || 0),
      });
    }
  }
  return trechos.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.ordem - right.ordem ||
      left.legId.localeCompare(right.legId, undefined, { numeric: true }),
  );
}

/**
 * O 1º trecho da NF (ordem operacional) precisa partir do ICAO do abastecimento.
 * Trechos seguintes podem usar o saldo sem tocar o aeroporto.
 */
export function validarOrigemAbastecimentoVibra(
  legIdsNovos: string[],
  abastecimentoId: string,
  aircraftFilter = "psjsa",
): ResultadoAlocacaoVibra {
  const idsNovos = [...new Set(legIdsNovos.filter(Boolean))];
  if (idsNovos.length === 0) {
    return { ok: false, motivo: "Nenhum trecho selecionado." };
  }
  const abast = ABASTECIMENTOS_VIBRA.find((item) => item.id === abastecimentoId);
  if (!abast) {
    return { ok: false, motivo: "Comprovante Vibra não encontrado." };
  }

  const ocupados = new Set(idsNovos);
  const legIdsExistentes = (getBase().alocacoesVibra ?? [])
    .filter((item) => item.abastecimentoId === abastecimentoId && !ocupados.has(item.legId))
    .map((item) => item.legId);
  const todosIds = new Set([...legIdsExistentes, ...idsNovos]);
  const trechos = listarTrechosOrigem(aircraftFilter).filter((item) => todosIds.has(item.legId));
  const primeiro = trechos[0];
  if (!primeiro) {
    return { ok: false, motivo: "Trechos selecionados não encontrados na operação." };
  }
  if (primeiro.fromIcao !== abast.icao) {
    return {
      ok: false,
      motivo: `NF abastecida em ${abast.icao}${abast.cidade ? ` (${abast.cidade})` : ""}, mas o 1º trecho parte de ${primeiro.fromIcao}. Só o saldo de trechos já alocados pode seguir fora do aeroporto.`,
    };
  }
  return { ok: true };
}

/** Liga trechos a um comprovante Vibra (substitui alocação anterior desses trechos). */
export function alocarTrechosVibra(
  legIds: string[],
  abastecimentoId: string,
): ResultadoAlocacaoVibra {
  const ids = [...new Set(legIds.filter(Boolean))];
  if (ids.length === 0 || !abastecimentoId) {
    return { ok: false, motivo: "Seleção ou comprovante inválido." };
  }
  const validacao = validarOrigemAbastecimentoVibra(ids, abastecimentoId);
  if (!validacao.ok) return validacao;

  updateBase((base) => {
    const ocupados = new Set(ids);
    const restantes = (base.alocacoesVibra ?? []).filter((item) => !ocupados.has(item.legId));
    return {
      ...base,
      alocacoesVibra: [
        ...restantes,
        ...ids.map((legId) => ({ legId, abastecimentoId })),
      ],
    };
  });
  return { ok: true };
}

/** Remove a alocação Vibra dos trechos informados. */
export function limparAlocacoesVibraTrechos(legIds: string[]): void {
  const ocupados = new Set(legIds.filter(Boolean));
  if (ocupados.size === 0) return;
  updateBase((base) => ({
    ...base,
    alocacoesVibra: (base.alocacoesVibra ?? []).filter((item) => !ocupados.has(item.legId)),
  }));
}

/** Desfaz a alocação de um único trecho. */
export function desfazerAlocacaoTrechoVibra(legId: string): void {
  if (!legId) return;
  limparAlocacoesVibraTrechos([legId]);
}

/** Desfaz todos os trechos ligados a um comprovante. */
export function desfazerAlocacaoNotaVibra(abastecimentoId: string): void {
  if (!abastecimentoId) return;
  updateBase((base) => ({
    ...base,
    alocacoesVibra: (base.alocacoesVibra ?? []).filter(
      (item) => item.abastecimentoId !== abastecimentoId,
    ),
  }));
}
