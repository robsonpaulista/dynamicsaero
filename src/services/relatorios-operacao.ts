import { CATEGORY_LABEL, POSTING_LABEL, PURPOSE_LABEL, STATUS_LABEL } from "@/lib/labels";
import {
  eDespesaFinanceira,
  eDespesaRateavel,
  expensesIn,
  expensesOfItinerary,
  getAircraft,
  getItinerary,
  getKpis,
  getRateio,
  itinerariesIn,
  itineraryCities,
  itineraryRoute,
  itinerarySpan,
  listNotasFiscais,
  monthsAtivos,
  monthsLabel,
  mesDeReferencia,
  partnerName,
  posicaoDespesas,
  tripHours,
  valorDoParceiro,
  type MonthFilter,
} from "@/services/operacao";
import type { Planilha, Relatorio } from "@/services/relatorios-rateio";
import type { Expense } from "@/types/operacao";

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

function cabecalho(months: MonthFilter, aircraftId: string, socio?: string | null): string[] {
  const linhas = [`Competência: ${monthsLabel(months)}`, `Recorte: ${escopo(aircraftId)}`, "JSA Aviação"];
  if (socio && socio !== "todos" && socio !== "sem") {
    linhas.push(`Sócio: ${partnerName(socio)}`);
  } else if (socio === "sem") {
    linhas.push("Sócio: sem identificação");
  }
  return linhas;
}

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function situacaoSaldo(saldo: number): string {
  if (saldo > 1) return "Em aberto";
  if (saldo < -1) return "Crédito";
  return "Em dia";
}

function socioDaDespesa(expense: Expense): string | null {
  if (expense.origem === "abastecimento") return null;
  if (expense.partnerId) return expense.partnerId;
  if (expense.itineraryId) return getItinerary(expense.itineraryId)?.requestedBy ?? null;
  return null;
}

function rotuloSocio(expense: Expense): string {
  if (expense.origem === "abastecimento") return "Operação (tanque)";
  const id = socioDaDespesa(expense);
  if (id) return partnerName(id);
  if (expense.allocation === "participacao") return "Participação";
  return "Sem identificação";
}

function naturezaDespesa(expense: Expense): string {
  if (expense.allocation === "solicitante") return "Voo";
  if (expense.category === "manutencao") return "Manutenção";
  return "Estrutura";
}

function tituloLancamento(expense: Expense): string {
  const parte = expense.description.split(" · ")[0]?.trim();
  const base = parte && parte.length > 0 ? parte : CATEGORY_LABEL[expense.category];
  return `${naturezaDespesa(expense)} · ${base}`;
}

function detalheLancamento(expense: Expense): string {
  const resto = expense.description.split(" · ").slice(1).join(" · ").trim();
  if (!resto) return expense.description;
  return resto.replace(/\s*→\s*/g, " > ");
}

function passaSocio(expense: Expense, socioFiltro: string): boolean {
  if (socioFiltro === "todos") return true;
  if (socioFiltro === "sem") {
    if (expense.origem === "abastecimento") return false;
    return socioDaDespesa(expense) === null && expense.allocation !== "participacao";
  }
  return valorDoParceiro(expense, socioFiltro) > 0;
}

function valorExibido(expense: Expense, socioFiltro: string): number {
  if (socioFiltro === "todos" || socioFiltro === "sem") return expense.amount;
  return valorDoParceiro(expense, socioFiltro);
}

function sufixoSocio(socioFiltro?: string | null): string {
  if (!socioFiltro || socioFiltro === "todos") return "";
  if (socioFiltro === "sem") return "-sem-socio";
  return `-${slug(partnerName(socioFiltro))}`;
}

export function relatorioPainel(
  months: MonthFilter,
  aircraftId: string,
  partnerId: string | null = null,
): Relatorio {
  const rateio = getRateio(months, aircraftId);
  const kpis = getKpis(months, aircraftId);
  const posicaoOperacao = posicaoDespesas(months, aircraftId, null);
  const posicaoEu = partnerId
    ? posicaoDespesas(months, aircraftId, partnerId)
    : null;
  const totalNfs = listNotasFiscais(months, aircraftId).reduce(
    (soma, item) => soma + item.amount,
    0,
  );
  const voos = itinerariesIn(months, aircraftId).filter((trip) => trip.status !== "cancelado");
  const horas = voos.reduce((soma, trip) => {
    const hours = tripHours(trip);
    return soma + hours.voadas + hours.previstas;
  }, 0);
  const faltaReceber = rateio.partners.reduce((soma, item) => soma + Math.max(0, item.saldo), 0);
  const eu = partnerId
    ? rateio.partners.find((item) => item.partnerId === partnerId)
    : undefined;

  const linhasMinhaConta: Array<[string, string | number]> =
    eu && posicaoEu
      ? [
          ["Falta pagar (minha conta)", Math.max(0, eu.saldo)],
          ["Sua parte", eu.total],
          ["Já faturado (sua parte)", posicaoEu.realizado],
          ["Ainda sem fatura (sua parte)", posicaoEu.provisionado + posicaoEu.previsto],
          ["Você já pagou", eu.pago],
          ["Situação", situacaoSaldo(eu.saldo)],
        ]
      : [];

  const resumo: Planilha = {
    nome: "Resumo",
    titulo: partnerId ? "Minha conta e custo da frota" : "Resumo do painel",
    notas: [
      ...cabecalho(months, aircraftId, partnerId),
      partnerId
        ? "Minha conta = sua fatia. Custo da frota = toda a operação no período."
        : "Despesas = faturado + previsto + provisionado. Aportes = já pago + em aberto.",
    ],
    colunas: ["Indicador", "Valor"],
    linhas: [
      ...linhasMinhaConta,
      ["Custo da frota", posicaoOperacao.total],
      ["Faturado", posicaoOperacao.realizado],
      ["Previsto", posicaoOperacao.previsto],
      ["Provisionado", posicaoOperacao.provisionado],
      ...(partnerId
        ? []
        : [
            ["Já pago pelos sócios", rateio.pago] as [string, number],
            ["Em aberto com os sócios", faltaReceber] as [string, number],
            ["NFs do período (comprovantes)", totalNfs] as [string, number],
          ]),
      ["Voos no período", voos.length],
      ["Horas no período", Number(horas.toFixed(1))],
      ["Custo por hora", kpis.custoHora === null ? "—" : Math.round(kpis.custoHora)],
    ],
    alinhamento: ["inicio", "fim"],
    larguras: [55, 30],
  };

  const socios: Planilha = {
    nome: "Sócios",
    titulo: partnerId ? "Minha posição" : "Situação dos sócios",
    notas: cabecalho(months, aircraftId, partnerId),
    colunas: ["Sócio", "Responsabilidade", "Pago", "Saldo", "Situação"],
    linhas: (eu ? [eu] : rateio.partners).map((item) => [
      partnerName(item.partnerId),
      item.total,
      item.pago,
      item.saldo,
      situacaoSaldo(item.saldo),
    ]),
    alinhamento: ["inicio", "fim", "fim", "fim", "inicio"],
    larguras: [36, 28, 24, 24, 22],
  };

  return {
    titulo: partnerId ? `Painel · ${partnerName(partnerId)}` : "Painel da operação",
    arquivo: `painel-${arquivoMes(months)}${sufixoSocio(partnerId)}`,
    subtitulo: `${monthsLabel(months)} · ${escopo(aircraftId)}`,
    planilhas: [resumo, socios],
  };
}

export function relatorioDespesas(
  months: MonthFilter,
  aircraftId: string,
  socioFiltro: string = "todos",
): Relatorio {
  const notasCab = cabecalho(months, aircraftId, socioFiltro);
  const socioEspecifico = socioFiltro !== "todos" && socioFiltro !== "sem";
  const posicao = posicaoDespesas(
    months,
    aircraftId,
    socioEspecifico ? socioFiltro : null,
  );
  const { total, realizado, previsto, provisionado, categorias } = posicao;
  const despesas = expensesIn(months, aircraftId)
    .filter((item) => (socioEspecifico ? eDespesaRateavel(item) : eDespesaFinanceira(item)))
    .filter((item) => passaSocio(item, socioFiltro))
    .sort((left, right) => right.date.localeCompare(left.date) || right.amount - left.amount);
  const nfs = listNotasFiscais(months, aircraftId);
  const totalNfs = nfs.reduce((soma, item) => soma + item.amount, 0);

  const resumo: Planilha = {
    nome: "Resumo",
    titulo: socioEspecifico ? "Minha parte nas despesas" : "Despesas do período",
    notas: [
      ...notasCab,
      "Faturado = realizado com NF. Previsto = ainda por vir. Provisionado = estimativa sem fatura.",
      "As NFs são comprovantes do faturado — não somam de novo no total.",
    ],
    colunas: ["Indicador", "Valor"],
    linhas: [
      ["Total no período", total],
      ["Faturado", realizado],
      ["Previsto", previsto],
      ["Provisionado (sem fatura)", provisionado],
      ["NFs do período (comprovantes)", totalNfs],
      ["Lançamentos", despesas.length],
    ],
    alinhamento: ["inicio", "fim"],
    larguras: [55, 28],
  };

  const porNatureza: Planilha = {
    nome: "Natureza",
    titulo: "Por natureza",
    notas: notasCab,
    colunas: ["Natureza", "Valor"],
    linhas: categorias.map((item) => [CATEGORY_LABEL[item.category], item.amount]),
    alinhamento: ["inicio", "fim"],
    larguras: [40, 28],
  };
  const totalNatureza = categorias.reduce((soma, item) => soma + item.amount, 0);
  porNatureza.linhas.push(["Total", totalNatureza]);

  const comSocio = !socioEspecifico;
  const lancamentos: Planilha = {
    nome: "Lançamentos",
    titulo: "Lançamentos do período",
    notas: notasCab,
    colunas: comSocio
      ? ["Data", "Lançamento", "Detalhe", "Aeronave", "Natureza", "Sócio", "Posição", "Valor"]
      : ["Data", "Lançamento", "Detalhe", "Aeronave", "Natureza", "Posição", "Valor"],
    linhas: despesas.map((item) => {
      const base: Array<string | number | null> = [
        item.date,
        tituloLancamento(item),
        detalheLancamento(item),
        getAircraft(item.aircraftId)?.registration ?? item.aircraftId,
        CATEGORY_LABEL[item.category],
      ];
      if (comSocio) base.push(rotuloSocio(item));
      base.push(POSTING_LABEL[item.posting], valorExibido(item, socioFiltro));
      return base;
    }),
    alinhamento: comSocio
      ? ["inicio", "inicio", "inicio", "inicio", "inicio", "inicio", "inicio", "fim"]
      : ["inicio", "inicio", "inicio", "inicio", "inicio", "inicio", "fim"],
    // Pesos pensados para landscape: detalhe leva o texto longo; aeronave/natureza ficam curtos.
    larguras: comSocio
      ? [14, 22, 42, 14, 16, 20, 14, 16]
      : [14, 24, 48, 14, 16, 14, 16],
  };
  const totalLinhas = despesas.reduce((soma, item) => soma + valorExibido(item, socioFiltro), 0);
  lancamentos.linhas.push(
    comSocio
      ? ["", "Total", "", "", "", "", "", totalLinhas]
      : ["", "Total", "", "", "", "", totalLinhas],
  );

  const planilhas = [resumo, porNatureza, lancamentos];
  if (nfs.length > 0) {
    planilhas.push({
      nome: "NF",
      titulo: "Comprovantes (NFs) — não somam no total",
      notas: [
        ...notasCab,
        "Mesmas NFs da Vibra/JSA — comprovantes do combustível já lançado como faturado.",
      ],
      colunas: ["Data", "NF", "Fornecedor", "Descrição", "Valor"],
      linhas: nfs.map((item) => [
        item.date,
        item.numero,
        item.fornecedor,
        item.descricao,
        item.amount,
      ]),
      alinhamento: ["inicio", "inicio", "inicio", "inicio", "fim"],
      larguras: [16, 16, 30, 48, 22],
    });
  }

  return {
    titulo: socioEspecifico
      ? `Despesas · ${partnerName(socioFiltro)}`
      : socioFiltro === "sem"
        ? "Despesas sem identificação"
        : "Despesas da operação",
    arquivo: `despesas-${arquivoMes(months)}${sufixoSocio(socioFiltro)}`,
    subtitulo: `${monthsLabel(months)} · ${escopo(aircraftId)}`,
    planilhas,
  };
}

export function relatorioVoos(
  months: MonthFilter,
  aircraftId: string,
  partnerId: string | null = null,
): Relatorio {
  const notas = cabecalho(months, aircraftId, partnerId);
  const trips = itinerariesIn(months, aircraftId)
    .filter((trip) => !partnerId || trip.requestedBy === partnerId)
    .sort((left, right) => (right.legs[0]?.date ?? "").localeCompare(left.legs[0]?.date ?? ""));

  const horas = trips.reduce((soma, trip) => {
    const hours = tripHours(trip);
    return soma + hours.voadas + hours.previstas;
  }, 0);
  const custo = trips.reduce((soma, trip) => {
    if (trip.status === "cancelado") return soma;
    return soma + expensesOfItinerary(trip.id).reduce((acc, item) => acc + item.amount, 0);
  }, 0);
  const kpis = getKpis(months, aircraftId);

  const resumo: Planilha = {
    nome: "Resumo",
    titulo: partnerId ? "Meus voos no período" : "Voos do período",
    notas,
    colunas: ["Indicador", "Valor"],
    linhas: [
      ["Voos", trips.length],
      ["Horas", Number(horas.toFixed(1))],
      ["Custo dos voos", custo],
      ["Custo por hora (operação)", kpis.custoHora === null ? "—" : Math.round(kpis.custoHora)],
    ],
    alinhamento: ["inicio", "fim"],
    larguras: [50, 28],
  };

  const lista: Planilha = {
    nome: "Voos",
    titulo: "Lista de voos",
    notas,
    colunas: partnerId
      ? ["Quando", "Itinerário", "Rota", "Aeronave", "Finalidade", "Horas", "Custo", "Situação"]
      : ["Quando", "Itinerário", "Rota", "Aeronave", "Pediu", "Finalidade", "Horas", "Custo", "Situação"],
    linhas: trips.map((trip) => {
      const span = itinerarySpan(trip);
      const when = span
        ? span.first === span.last
          ? span.first
          : `${span.first} a ${span.last}`
        : "";
      const hours = tripHours(trip);
      const totalHoras = Number((hours.voadas + hours.previstas).toFixed(1));
      const tripCost =
        trip.status === "cancelado"
          ? null
          : expensesOfItinerary(trip.id).reduce((acc, item) => acc + item.amount, 0);
      const base: Array<string | number | null> = [
        when,
        itineraryCities(trip) || trip.title,
        itineraryRoute(trip),
        getAircraft(trip.aircraftId)?.registration ?? trip.aircraftId,
      ];
      if (!partnerId) base.push(partnerName(trip.requestedBy));
      base.push(
        PURPOSE_LABEL[trip.purpose],
        totalHoras,
        tripCost,
        STATUS_LABEL[trip.status] ?? trip.status,
      );
      return base;
    }),
    alinhamento: partnerId
      ? ["inicio", "inicio", "inicio", "inicio", "inicio", "fim", "fim", "inicio"]
      : ["inicio", "inicio", "inicio", "inicio", "inicio", "inicio", "fim", "fim", "inicio"],
    larguras: partnerId
      ? [22, 36, 22, 16, 16, 14, 20, 16]
      : [20, 32, 20, 14, 20, 14, 12, 18, 14],
  };

  return {
    titulo: partnerId ? `Voos · ${partnerName(partnerId)}` : "Itinerários da operação",
    arquivo: `voos-${arquivoMes(months)}${sufixoSocio(partnerId)}`,
    subtitulo: `${monthsLabel(months)} · ${escopo(aircraftId)}`,
    planilhas: [resumo, lista],
  };
}
