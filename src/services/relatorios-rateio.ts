import { METODO_LABEL } from "@/lib/labels";
import {
  contaCorrente,
  getAircraft,
  getPartner,
  getRateio,
  listAportes,
  listMonths,
  monthLabel,
  partnerName,
} from "@/services/operacao";
import type { Aporte } from "@/types/operacao";

export type Celula = string | number | null;
export type Alinhamento = "inicio" | "fim";

export type Planilha = {
  nome: string;
  titulo: string;
  notas: string[];
  colunas: string[];
  linhas: Celula[][];
  larguras?: number[];
  alinhamento?: Alinhamento[];
  negrito?: boolean[];
  cores?: Array<string | null>;
};

export type Relatorio = {
  titulo: string;
  arquivo: string;
  subtitulo: string;
  planilhas: Planilha[];
};

function situacao(saldo: number): string {
  if (saldo > 1) return "Em aberto";
  if (saldo < -1) return "Crédito";
  return "Em dia";
}

function escopo(aircraftId: string): string {
  if (aircraftId === "todas") return "Toda a operação";
  return getAircraft(aircraftId)?.registration ?? aircraftId;
}

function nomeAba(nome: string): string {
  return nome.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
}

function aportesDoRecorte(month: string, aircraftId: string): Aporte[] {
  return listAportes(month).filter(
    (item) => aircraftId === "todas" || item.aircraftId === null || item.aircraftId === aircraftId,
  );
}

function cabecalho(month: string, aircraftId: string): string[] {
  return [`Competência: ${monthLabel(month)}`, `Recorte: ${escopo(aircraftId)}`, "Ventura Aviação"];
}

export function relatorioPendencias(month: string, aircraftId: string): Relatorio {
  const rateio = getRateio(month, aircraftId);
  const posicao: Planilha = {
    nome: "Posição",
    titulo: "Posição por cotista",
    notas: cabecalho(month, aircraftId),
    colunas: ["Cotista", "Comprometido", "Já pago", "Saldo", "Situação"],
    linhas: rateio.partners.map((item) => [
      partnerName(item.partnerId),
      item.total,
      item.pago,
      item.saldo,
      situacao(item.saldo),
    ]),
  };
  posicao.linhas.push(["Total", rateio.total, rateio.pago, rateio.saldo, situacao(rateio.saldo)]);

  const abertos = rateio.partners.filter((item) => item.saldo > 1);
  const pendencias: Planilha = {
    nome: "Pendências",
    titulo: "Pendências do mês",
    notas: cabecalho(month, aircraftId),
    colunas: ["Cotista", "Empresa", "Saldo em aberto"],
    linhas: abertos.map((item) => [
      partnerName(item.partnerId),
      getPartner(item.partnerId)?.company ?? "",
      item.saldo,
    ]),
  };

  const aeronaves = rateio.partners[0]?.byAircraft.map((item) => item.aircraftId) ?? [];
  const porAeronave: Planilha = {
    nome: "Por aeronave",
    titulo: "Conta por aeronave",
    notas: cabecalho(month, aircraftId),
    colunas: ["Aeronave", ...rateio.partners.map((item) => partnerName(item.partnerId)), "Total"],
    linhas: aeronaves.map((id) => {
      const fatias = rateio.partners.map(
        (item) => item.byAircraft.find((slice) => slice.aircraftId === id)?.total ?? 0,
      );
      const total = fatias.reduce<number>((soma, valor) => soma + (typeof valor === "number" ? valor : 0), 0);
      return [getAircraft(id)?.registration ?? id, ...fatias, total];
    }),
  };

  const historico: Planilha = {
    nome: "Histórico",
    titulo: "Pendências por competência",
    notas: ["Todas as competências lançadas", `Recorte: ${escopo(aircraftId)}`],
    colunas: ["Competência", "Cotista", "Comprometido", "Já pago", "Saldo", "Situação"],
    linhas: [],
  };
  for (const item of listMonths()) {
    const leitura = getRateio(item.id, aircraftId);
    for (const partner of leitura.partners) {
      if (partner.saldo <= 1 && partner.pago <= 0 && partner.total <= 0) continue;
      historico.linhas.push([
        item.label,
        partnerName(partner.partnerId),
        partner.total,
        partner.pago,
        partner.saldo,
        situacao(partner.saldo),
      ]);
    }
  }

  return {
    titulo: "Pendências por cotista",
    arquivo: `pendencias-${month}`,
    subtitulo: `${monthLabel(month)} · ${escopo(aircraftId)}`,
    planilhas: [pendencias, posicao, porAeronave, historico],
  };
}

export function relatorioPagamentos(month: string, aircraftId: string): Relatorio {
  const doMes = aportesDoRecorte(month, aircraftId);
  const mes: Planilha = {
    nome: "Pagamentos",
    titulo: "Pagamentos realizados",
    notas: cabecalho(month, aircraftId),
    colunas: ["Data", "Cotista", "Forma", "Referência", "Escopo", "Valor", "Nota"],
    linhas: doMes.map((item) => [
      item.date,
      partnerName(item.partnerId),
      METODO_LABEL[item.method],
      item.reference,
      item.aircraftId ? (getAircraft(item.aircraftId)?.registration ?? item.aircraftId) : "Operação",
      item.amount,
      item.note,
    ]),
  };
  const total = doMes.reduce((soma, item) => soma + item.amount, 0);
  mes.linhas.push(["", "Total", "", "", "", total, ""]);

  const historico: Planilha = {
    nome: "Histórico",
    titulo: "Todos os pagamentos",
    notas: [`Recorte: ${escopo(aircraftId)}`],
    colunas: ["Data", "Competência", "Cotista", "Forma", "Referência", "Escopo", "Valor", "Nota"],
    linhas: listAportes()
      .filter((item) => aircraftId === "todas" || item.aircraftId === null || item.aircraftId === aircraftId)
      .map((item) => [
        item.date,
        monthLabel(item.month),
        partnerName(item.partnerId),
        METODO_LABEL[item.method],
        item.reference,
        item.aircraftId ? (getAircraft(item.aircraftId)?.registration ?? item.aircraftId) : "Operação",
        item.amount,
        item.note,
      ]),
  };

  return {
    titulo: "Pagamentos realizados",
    arquivo: `pagamentos-${month}`,
    subtitulo: `${monthLabel(month)} · ${escopo(aircraftId)}`,
    planilhas: [mes, historico],
  };
}

function extratoDe(partnerId: string, month: string, aircraftId: string): Planilha {
  const conta = contaCorrente(partnerId, month, aircraftId);
  const nome = partnerName(partnerId);
  const empresa = getPartner(partnerId)?.company ?? "";
  const linhas: Celula[][] = [["", "Saldo anterior", null, null, conta.saldoAnterior]];
  const negrito = [true];
  for (const item of conta.lancamentos) {
    linhas.push([
      item.date,
      item.historico,
      item.natureza === "debito" ? item.valor : null,
      item.natureza === "credito" ? item.valor : null,
      item.saldo,
    ]);
    negrito.push(false);
  }
  linhas.push(["", "Saldo da conta", conta.debitos, conta.creditos, conta.saldo]);
  negrito.push(true);

  return {
    nome: nomeAba(nome),
    titulo: `Conta corrente · ${nome}`,
    notas: [
      ...cabecalho(month, aircraftId),
      empresa,
      "Débito é despesa lançada na conta. Crédito é aporte. Saldo positivo é o que ainda falta pagar.",
      `Situação: ${situacao(conta.saldo)}`,
    ],
    colunas: ["Data", "Histórico", "Débito", "Crédito", "Saldo"],
    linhas,
    larguras: [18, 70, 26, 26, 28],
    alinhamento: ["inicio", "inicio", "fim", "fim", "fim"],
    cores: [null, null, "#EF4444", "#334155", null],
    negrito,
  };
}

export function relatorioExtrato(partnerId: string, month: string, aircraftId: string): Relatorio {
  const nome = partnerName(partnerId).toLowerCase().replace(/\s+/g, "-");
  return {
    titulo: `Conta corrente de ${partnerName(partnerId)}`,
    arquivo: `conta-${nome}-${month}`,
    subtitulo: `${monthLabel(month)} · ${escopo(aircraftId)}`,
    planilhas: [extratoDe(partnerId, month, aircraftId)],
  };
}

export function relatorioExtratos(month: string, aircraftId: string): Relatorio {
  const rateio = getRateio(month, aircraftId);
  return {
    titulo: "Contas correntes dos cotistas",
    arquivo: `contas-${month}`,
    subtitulo: `${monthLabel(month)} · ${escopo(aircraftId)}`,
    planilhas: rateio.partners.map((item) => extratoDe(item.partnerId, month, aircraftId)),
  };
}
