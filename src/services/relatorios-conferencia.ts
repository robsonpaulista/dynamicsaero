import { formatDate, formatHours } from "@/lib/format";
import type {
  ConferenciaLinha,
  ConferenciaPrestacao,
  ConferenciaVibraLinha,
  ConferenciaVibraPorData,
  ConferenciaVibraStatus,
} from "@/services/conferencia";
import {
  getAircraft,
  monthsAtivos,
  monthsLabel,
  mesDeReferencia,
  partnerShort,
  type MonthFilter,
} from "@/services/operacao";
import type { Planilha, Relatorio } from "@/services/relatorios-rateio";

function escopo(aircraftId: string): string {
  if (aircraftId === "todas") return "Toda a operação";
  return getAircraft(aircraftId)?.registration ?? aircraftId;
}

function arquivoMes(months: MonthFilter): string {
  const ativos = monthsAtivos(months);
  if (!ativos) return "todos";
  if (ativos.length === 1) return ativos[0] ?? mesDeReferencia(months);
  return `${ativos[0]}_${ativos[ativos.length - 1]}`;
}

function cabecalho(months: MonthFilter, aircraftId: string, extra?: string | null): string[] {
  const linhas = [`Competência: ${monthsLabel(months)}`, `Recorte: ${escopo(aircraftId)}`, "JSA Aviação"];
  if (extra) linhas.push(extra);
  return linhas;
}

function formatLitros(value: number): string {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value)} L`;
}

function formatPrecoLitro(value: number | null): string {
  if (value == null || !(value > 0)) return "—";
  return `${new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value)}/L`;
}

function rotuloParticipacao(aircraftId: string): string {
  const nomes =
    getAircraft(aircraftId)?.ownership.map((item) => partnerShort(item.partnerId)) ?? [];
  return nomes.length > 0 ? nomes.join("/") : "TODOS";
}

function rotuloStatus(status: ConferenciaVibraStatus): string {
  switch (status) {
    case "sem_voo":
      return "Sem voo";
    case "sem_abast":
      return "Sem abast.";
    case "vizinho":
      return "Outro dia";
    case "atencao":
      return "Atenção";
    default:
      return "Alocado";
  }
}

function notasFatias(notas: ConferenciaLinha["combNotas"]): string {
  if (notas.length === 0) return "—";
  return notas.map((nota) => nota.numero).join(", ");
}

export function relatorioConferenciaVibra(
  months: MonthFilter,
  aircraftId: string,
  dados: ConferenciaVibraPorData,
  linhas: ConferenciaVibraLinha[],
): Relatorio {
  const notasCab = cabecalho(months, aircraftId);
  const orfas =
    dados.notasSemComprovante.length > 0
      ? [
          `Diferença ${new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(dados.totalFaturadoPeriodo - dados.totalValor)} · ${dados.notasSemComprovante.length} NF(s) sem comprovante`,
          ...dados.notasSemComprovante.map(
            (nota) =>
              `NF ${nota.numero}${nota.referencia ? ` · ref. ${nota.referencia}` : ""} · ${formatDate(nota.date)} · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(nota.amount)}`,
          ),
        ]
      : ["Todas as NFs do período com comprovante na pasta."];

  const resumo: Planilha = {
    nome: "Resumo",
    titulo: "Checagem · voo × abastecimento",
    notas: [
      ...notasCab,
      "Trechos na ordem dos voos importados; abastecimento por alocação manual.",
      ...orfas,
    ],
    colunas: ["Indicador", "Valor"],
    linhas: [
      ["Trechos", String(dados.linhas.length)],
      ["Sem abastecimento", String(dados.semAbast)],
      ["Abastecimentos", String(dados.totalAbastecimentos)],
      ["Litros (comprovantes)", formatLitros(dados.totalLitros)],
      ["Com comprovante (R$)", dados.totalValor],
      ["Faturamento Vibra (R$)", dados.totalFaturadoPeriodo],
      ["R$/L mediano", formatPrecoLitro(dados.precoLitroMediano)],
      ["NFs com trecho", String(dados.comVoo)],
      ["NFs sem trecho", String(dados.semVoo)],
      ["Em atenção", String(dados.atencao)],
    ],
    alinhamento: ["inicio", "fim"],
    larguras: [55, 30],
  };

  const tabela: Planilha = {
    nome: "Trechos",
    titulo: "Tabela · voos × Vibra",
    notas: [
      ...notasCab,
      "Litros NF / Valor NF repetidos em todos os trechos da mesma alocação manual.",
    ],
    colunas: [
      "Data",
      "Trecho",
      "Tempo",
      "Litros",
      "Sócio",
      "Ref. abast.",
      "Local",
      "Litros NF",
      "Valor NF",
      "Checagem",
    ],
    linhas: [
      ...linhas.map((linha) => [
        linha.date,
        linha.route,
        linha.blockHours > 0 ? formatHours(linha.blockHours) : "—",
        linha.litrosCalc > 0 ? formatLitros(linha.litrosCalc) : "—",
        linha.rateioParticipacao ? "Participação" : partnerShort(linha.partnerId),
        linha.referencia ? `Ref. ${linha.referencia}` : "—",
        linha.icao ?? "—",
        linha.litrosAbast != null ? formatLitros(linha.litrosAbast) : "—",
        linha.amount != null ? linha.amount : "—",
        `${rotuloStatus(linha.status)} · ${linha.detalhe}`,
      ]),
      [
        `Total · ${linhas.length} trecho(s)`,
        null,
        null,
        null,
        null,
        null,
        null,
        formatLitros(dados.totalLitros),
        dados.totalValor,
        null,
      ],
    ],
    negrito: [...linhas.map((linha) => linha.matchTipo === "vizinho"), true],
    alinhamento: [
      "inicio",
      "inicio",
      "fim",
      "fim",
      "inicio",
      "inicio",
      "inicio",
      "fim",
      "fim",
      "inicio",
    ],
    larguras: [12, 28, 10, 12, 14, 12, 10, 12, 14, 28],
  };

  const porSocio: Planilha = {
    nome: "Por socio",
    titulo: "Totais por sócio · valor rateado pelos trechos",
    notas: notasCab,
    colunas: ["Sócio", "Trechos", "Abastecimentos", "Litros", "Combustível"],
    linhas: dados.porSolicitante.map((item) => [
      partnerShort(item.partnerId),
      item.trechos,
      item.abastecimentos,
      formatLitros(item.litros),
      item.combustivel,
    ]),
    alinhamento: ["inicio", "fim", "fim", "fim", "fim"],
    larguras: [28, 14, 18, 18, 22],
  };

  return {
    titulo: "Vibra · abastecimentos",
    arquivo: `conferencia-vibra-${arquivoMes(months)}`,
    subtitulo: `${monthsLabel(months)} · ${escopo(aircraftId)}`,
    planilhas: [
      resumo,
      ...(dados.porSolicitante.length > 0 ? [porSocio] : []),
      tabela,
    ],
  };
}

export function relatorioConferenciaPrestacao(
  months: MonthFilter,
  aircraftId: string,
  dados: ConferenciaPrestacao,
  linhas: ConferenciaLinha[],
  filtroSocio: string | null,
): Relatorio {
  const socioExtra = filtroSocio ? `Filtro sócio: ${partnerShort(filtroSocio)}` : null;
  const notasCab = cabecalho(months, aircraftId, socioExtra);
  const vibra = dados.combustivel;
  const taxas = dados.taxas;
  const totalDespesas = dados.totalNotas;
  const totalDistribuido = dados.totalDistribuido;
  const saldo = Math.max(0, Math.round((totalDespesas - totalDistribuido) * 100) / 100);
  const fechado = saldo <= 0.02 && totalDespesas > 0;

  const totalComb = Math.round(
    linhas.reduce((soma, linha) => soma + (linha.combNaNf ? linha.combCalculo : 0), 0) * 100,
  ) / 100;
  const totalTaxas =
    Math.round(linhas.reduce((soma, linha) => soma + linha.taxasCalculo, 0) * 100) / 100;

  const resumo: Planilha = {
    nome: "Resumo",
    titulo: "Despesas · notas × trechos",
    notas: [
      ...notasCab,
      "Uma linha por trecho · combustível Vibra + taxas aeroportuárias (FIFO).",
      fechado
        ? "Conferência fechada."
        : saldo > 0.009
          ? `Saldo em aberto: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(saldo)}`
          : "Sem saldo relevante.",
    ],
    colunas: ["Indicador", "Valor"],
    linhas: [
      ["Combustível · Vibra (NFs)", vibra.valor],
      ["Combustível nos trechos", vibra.distribuido],
      ["Taxas aeroportuárias (NFs)", taxas.valor],
      ["Taxas nos trechos", taxas.distribuido],
      ["Total despesas", totalDespesas > 0 ? totalDespesas : vibra.valor + taxas.distribuido],
      ["Total distribuído", totalDistribuido],
      ["Trechos na tabela", linhas.length],
      ...(vibra.litrosDistribuidos > 0 && !filtroSocio
        ? ([["Litros rateados", formatLitros(vibra.litrosDistribuidos)]] as Array<[string, string]>)
        : []),
    ],
    alinhamento: ["inicio", "fim"],
    larguras: [55, 30],
  };

  const porSocio: Planilha = {
    nome: "Por socio",
    titulo: "Totais por solicitante",
    notas: notasCab,
    colunas: ["Sócio", "Trechos", "Combustível", "Taxas", "Total"],
    linhas: dados.porSolicitante.map((item) => [
      partnerShort(item.partnerId),
      item.trechos,
      item.combustivel,
      item.taxas,
      Math.round((item.combustivel + item.taxas) * 100) / 100,
    ]),
    alinhamento: ["inicio", "fim", "fim", "fim", "fim"],
    larguras: [28, 14, 22, 22, 22],
  };

  const tabela: Planilha = {
    nome: "Trechos",
    titulo: "Tabela · prestação de contas",
    notas: notasCab,
    colunas: [
      "Data",
      "Trecho",
      "Tempo",
      "Litros",
      "Sócio",
      "Combustível",
      "NF Vibra",
      "Taxas",
      "NF taxas",
    ],
    linhas: [
      ...linhas.map((linha) => [
        linha.date,
        linha.route,
        linha.blockHours > 0 ? formatHours(linha.blockHours) : "—",
        linha.litros > 0 ? formatLitros(linha.litros) : "—",
        linha.rateioParticipacao && !filtroSocio
          ? rotuloParticipacao(linha.aircraftId)
          : `${partnerShort(linha.partnerId)}${linha.rateioParticipacao ? " · cota" : ""}`,
        linha.combCalculo > 0 ? linha.combCalculo : null,
        notasFatias(linha.combNotas),
        linha.taxasCalculo > 0 ? linha.taxasCalculo : null,
        notasFatias(linha.taxasNotas),
      ]),
      [
        `Total · ${linhas.length} trecho(s)${filtroSocio ? ` · ${partnerShort(filtroSocio)}` : ""}`,
        null,
        null,
        null,
        null,
        totalComb,
        null,
        totalTaxas > 0 ? totalTaxas : null,
        null,
      ],
    ],
    negrito: [...linhas.map(() => false), true],
    alinhamento: ["inicio", "inicio", "fim", "fim", "inicio", "fim", "inicio", "fim", "inicio"],
    larguras: [14, 28, 12, 12, 18, 18, 16, 16, 16],
  };

  return {
    titulo: "Prestação de contas",
    arquivo: `conferencia-prestacao-${arquivoMes(months)}${filtroSocio ? `-${filtroSocio}` : ""}`,
    subtitulo: `${monthsLabel(months)} · ${escopo(aircraftId)}${filtroSocio ? ` · ${partnerShort(filtroSocio)}` : ""}`,
    planilhas: [resumo, ...(dados.porSolicitante.length > 0 ? [porSocio] : []), tabela],
  };
}
