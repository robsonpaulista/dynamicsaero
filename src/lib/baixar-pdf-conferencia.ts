import { formatBRL, formatDate, formatHours } from "@/lib/format";
import { HOJE } from "@/data/calendario";
import { corDoSocio, fundoCalendarioSocio } from "@/lib/labels";
import type {
  ConferenciaLinha,
  ConferenciaPrestacao,
  ConferenciaSolicitante,
  ConferenciaVibraLinha,
  ConferenciaVibraPorData,
  ConferenciaVibraSolicitante,
  ConferenciaVibraStatus,
} from "@/services/conferencia";
import { getAircraft, monthsLabel, partnerShort, type MonthFilter } from "@/services/operacao";

type JsPdf = import("jspdf").jsPDF;

/** Paleta Evolux da aplicação (carvão + amarelo + cinzas). */
const COR = {
  carvao: [74, 74, 73] as [number, number, number],
  amarelo: [245, 196, 0] as [number, number, number],
  amareloForte: [255, 210, 74] as [number, number, number],
  soft: [255, 248, 224] as [number, number, number],
  bg: [247, 247, 245] as [number, number, number],
  texto: [74, 74, 73] as [number, number, number],
  muted: [112, 112, 112] as [number, number, number],
  linha: [230, 230, 230] as [number, number, number],
  branco: [255, 255, 255] as [number, number, number],
};

const ALTURA_CABECALHO = 16;

function escopo(aircraftId: string): string {
  if (aircraftId === "todas") return "Toda a operação";
  return getAircraft(aircraftId)?.registration ?? aircraftId;
}

/** Helvetica do jsPDF não desenha bem setas/unicode — troca por ASCII seguro. */
function limpar(texto: string): string {
  return texto
    .replace(/\u2014|\u2013/g, "-")
    .replace(/\u00a0|\u202f/g, " ")
    .replace(/→/g, ">")
    .replace(/↔/g, "<->")
    .replace(/×/g, "x")
    .replace(/Δ/g, "D")
    .replace(/·/g, "|")
    .replace(/—/g, "-");
}

/** Rota curta para PDF: SBTE > SJ4E (evita nomes longos e setas quebradas). */
function rotaCurtaPdf(route: string): string {
  const emParenteses = [...route.matchAll(/\(([A-Z0-9]{4})\)/gi)].map((m) =>
    (m[1] ?? "").toUpperCase(),
  );
  if (emParenteses.length >= 2) {
    return `${emParenteses[0]} > ${emParenteses[emParenteses.length - 1]}`;
  }
  const partes = route
    .split(/\s*(?:→|↔|->|>)\s*/)
    .map((parte) => {
      const m = /\b([A-Z0-9]{4})\b/i.exec(parte);
      return m?.[1]?.toUpperCase() ?? null;
    })
    .filter((codigo): codigo is string => Boolean(codigo));
  if (partes.length >= 2) {
    return `${partes[0]} > ${partes[partes.length - 1]}`;
  }
  return limpar(route);
}

function formatLitros(value: number): string {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value)} L`;
}

function formatPrecoLitro(value: number | null): string {
  if (value == null || !(value > 0)) return "-";
  const texto = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
  return `${limpar(texto)}/L`;
}

function rotuloStatusLinha(status: ConferenciaVibraStatus): string {
  switch (status) {
    case "sem_voo":
      return "Sem voo";
    case "sem_abast":
      return "Sem abast.";
    case "vizinho":
      return "Outro dia";
    case "atencao":
      return "Atencao";
    default:
      return "Alocado";
  }
}

function corStatus(status: ConferenciaVibraStatus): [number, number, number] {
  switch (status) {
    case "sem_voo":
      return [185, 28, 28];
    case "sem_abast":
      return COR.muted;
    case "vizinho":
      return [29, 78, 216];
    case "atencao":
      return [194, 65, 12];
    default:
      return [21, 128, 61];
  }
}

function fundoStatus(status: ConferenciaVibraStatus): [number, number, number] {
  switch (status) {
    case "sem_voo":
      return [254, 242, 242];
    case "sem_abast":
      return [247, 248, 249];
    case "vizinho":
      return [239, 246, 255];
    case "atencao":
      return [255, 247, 237];
    default:
      return [236, 253, 243];
  }
}

function rotuloParticipacao(aircraftId: string): string {
  const nomes =
    getAircraft(aircraftId)?.ownership.map((item) => partnerShort(item.partnerId)) ?? [];
  return nomes.length > 0 ? nomes.join("/") : "TODOS";
}

function baixarBlob(nome: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

type AnexoVibraPdf = {
  chave: string;
  referencia: string;
  icao: string | null;
  data: string | null;
  url: string;
};

/** Ordem = sequência da tabela (1ª aparição de cada NF alocada). */
function listarAnexosVibra(linhas: ConferenciaVibraLinha[]): AnexoVibraPdf[] {
  const mapa = new Map<string, AnexoVibraPdf>();
  for (const linha of linhas) {
    const url = linha.anexoUrl?.trim();
    if (!url || !linha.abastecimentoId) continue;
    const chave = linha.abastecimentoId;
    if (mapa.has(chave)) continue;
    mapa.set(chave, {
      chave,
      referencia: linha.referencia ?? chave,
      icao: linha.icao,
      data: linha.abastDate,
      url,
    });
  }
  return [...mapa.values()];
}

async function carregarPdfBytes(url: string): Promise<Uint8Array | null> {
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return null;
    return new Uint8Array(await resposta.arrayBuffer());
  } catch {
    return null;
  }
}

async function mesclarComAnexosVibra(
  relatorio: Uint8Array,
  anexos: AnexoVibraPdf[],
): Promise<Blob> {
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

  const final = await PDFDocument.create();
  const base = await PDFDocument.load(relatorio);
  const paginasBase = await final.copyPages(base, base.getPageIndices());
  for (const pagina of paginasBase) final.addPage(pagina);

  if (anexos.length === 0) {
    const bytes = await final.save();
    return new Blob([bytes.slice()], { type: "application/pdf" });
  }

  type PrintAnexo = {
    anexo: AnexoVibraPdf;
    pagina: Awaited<ReturnType<typeof final.embedPage>>;
    indice: number;
  };

  const prints: PrintAnexo[] = [];
  let indice = 1;
  for (const anexo of anexos) {
    const bytes = await carregarPdfBytes(anexo.url);
    if (!bytes) continue;
    try {
      const docAnexo = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const origem = docAnexo.getPages()[0];
      if (!origem) continue;
      const embutida = await final.embedPage(origem);
      prints.push({ anexo, pagina: embutida, indice });
      indice += 1;
    } catch {
      // ignora comprovante ilegível e segue com os demais
    }
  }

  if (prints.length === 0) {
    const bytes = await final.save();
    return new Blob([bytes.slice()], { type: "application/pdf" });
  }

  const fonte = await final.embedFont(StandardFonts.HelveticaBold);
  const fonteNormal = await final.embedFont(StandardFonts.Helvetica);
  const pageW = 841.89;
  const pageH = 595.28;
  const margem = 16;
  const headerH = 36;
  const labelH = 12;
  const gapX = 10;
  const gapY = 10;
  const cols = 4;
  const rows = 2;
  const porPagina = cols * rows;
  const areaW = pageW - margem * 2;
  const areaH = pageH - headerH - 3 - margem * 2;
  const slotW = (areaW - gapX * (cols - 1)) / cols;
  const slotH = (areaH - gapY * (rows - 1)) / rows;

  for (let i = 0; i < prints.length; i += porPagina) {
    const lote = prints.slice(i, i + porPagina);
    const pagina = final.addPage([pageW, pageH]);

    pagina.drawRectangle({
      x: 0,
      y: pageH - headerH,
      width: pageW,
      height: headerH,
      color: rgb(74 / 255, 74 / 255, 73 / 255),
    });
    pagina.drawRectangle({
      x: 0,
      y: pageH - headerH - 3,
      width: pageW,
      height: 3,
      color: rgb(245 / 255, 196 / 255, 0 / 255),
    });
    pagina.drawText("ANEXOS · comprovantes de abastecimento", {
      x: margem,
      y: pageH - 22,
      size: 11,
      font: fonte,
      color: rgb(1, 1, 1),
    });
    const faixa = `Página ${Math.floor(i / porPagina) + 1} · ${prints.length} comprovante(s)`;
    pagina.drawText(faixa, {
      x: pageW - margem - fonteNormal.widthOfTextAtSize(faixa, 8),
      y: pageH - 22,
      size: 8,
      font: fonteNormal,
      color: rgb(1, 1, 1),
    });

    lote.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x0 = margem + col * (slotW + gapX);
      const y0 = pageH - headerH - 3 - margem - (row + 1) * slotH - row * gapY;

      const detalhe = limpar(
        [`${item.indice}. Ref. ${item.anexo.referencia}`, item.anexo.icao]
          .filter(Boolean)
          .join(" · "),
      );
      pagina.drawText(detalhe, {
        x: x0,
        y: y0 + slotH - 9,
        size: 7,
        font: fonte,
        color: rgb(74 / 255, 74 / 255, 73 / 255),
        maxWidth: slotW,
      });

      const boxW = slotW;
      const boxH = slotH - labelH;
      const origemW = item.pagina.width;
      const origemH = item.pagina.height;
      const escala = Math.min(boxW / origemW, boxH / origemH);
      const desenhoW = origemW * escala;
      const desenhoH = origemH * escala;
      const x = x0 + (boxW - desenhoW) / 2;
      const y = y0 + (boxH - desenhoH) / 2;

      pagina.drawRectangle({
        x: x0,
        y: y0,
        width: boxW,
        height: boxH,
        borderColor: rgb(230 / 255, 230 / 255, 230 / 255),
        borderWidth: 0.6,
        color: rgb(1, 1, 1),
      });
      pagina.drawPage(item.pagina, {
        x,
        y,
        width: desenhoW,
        height: desenhoH,
      });
    });
  }

  const saida = await final.save();
  return new Blob([saida.slice()], { type: "application/pdf" });
}

function quebrar(
  doc: JsPdf,
  texto: string,
  largura: number,
  maxLinhas = 8,
): string[] {
  const limpo = limpar(texto).trim();
  if (!limpo) return [""];
  const linhas = doc.splitTextToSize(limpo, Math.max(largura, 6)) as string[];
  if (linhas.length <= maxLinhas) return linhas;
  const visiveis = linhas.slice(0, maxLinhas);
  visiveis[maxLinhas - 1] = `${(visiveis[maxLinhas - 1] ?? "").replace(/\s+$/, "")}…`;
  return visiveis;
}

type LinhaCelula = {
  texto: string;
  bold?: boolean;
  cor?: [number, number, number];
  fundo?: [number, number, number];
  pill?: boolean;
  size?: number;
  /** Espaço extra abaixo desta linha (mm). */
  gapApos?: number;
};

type BlocoCelula = {
  linhas: LinhaCelula[];
};

function passoLinha(linha: LinhaCelula, alturaLinha: number): number {
  const size = linha.size ?? 7.5;
  return alturaLinha * (size / 7.5) + (linha.gapApos ?? 0);
}

function alturaBloco(bloco: BlocoCelula, alturaLinha: number): number {
  if (bloco.linhas.length === 0) return alturaLinha + 2.2;
  const corpo = bloco.linhas.reduce(
    (soma, linha) => soma + passoLinha(linha, alturaLinha),
    0,
  );
  return corpo + 2.2;
}

async function criarDoc(): Promise<JsPdf> {
  const { jsPDF } = await import("jspdf");
  return new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
}

/** Marca “A” do wordmark (viewBox 32×32), alinhada ao shell. */
function desenharLogo(doc: JsPdf, x: number, y: number, tamanho = 8): void {
  const s = tamanho / 32;
  const px = (vx: number) => x + vx * s;
  const py = (vy: number) => y + vy * s;
  const r = 8 * s;

  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.35);
  doc.roundedRect(px(0.75), py(0.75), 30.5 * s, 30.5 * s, r, r, "D");

  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(Math.max(0.45, 1.7 * s));
  doc.line(px(9.2), py(23.2), px(16), py(8.4));
  doc.line(px(16), py(8.4), px(22.8), py(23.2));

  doc.setDrawColor(...COR.amarelo);
  doc.setLineWidth(Math.max(0.45, 1.7 * s));
  doc.line(px(12), py(17.4), px(20), py(17.4));
}

function cabecalhoPagina(
  doc: JsPdf,
  tituloContinuidade: string | null,
  margem: number,
): void {
  const largura = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COR.carvao);
  doc.rect(0, 0, largura, ALTURA_CABECALHO, "F");
  doc.setFillColor(...COR.amarelo);
  doc.rect(0, ALTURA_CABECALHO - 1.1, largura, 1.1, "F");

  const logoSize = 9;
  const logoY = (ALTURA_CABECALHO - 1.1 - logoSize) / 2;
  desenharLogo(doc, margem, logoY, logoSize);

  const textoX = margem + logoSize + 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text("DYNAMICS", textoX, 6.2);
  doc.setFontSize(11);
  doc.text("AERO", textoX, 11.2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(limpar(tituloContinuidade ?? "Ventura Aviação"), largura - margem, 9.6, {
    align: "right",
  });
  doc.setTextColor(...COR.texto);
}

function rodape(doc: JsPdf, margem: number): void {
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setDrawColor(...COR.amarelo);
    doc.setLineWidth(0.6);
    doc.line(margem, altura - 9, largura - margem, altura - 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COR.muted);
    doc.text(`Página ${pagina} de ${paginas}`, largura - margem, altura - 5, {
      align: "right",
    });
  }
}

function yAposCabecalho(): number {
  return ALTURA_CABECALHO + 6;
}

function hexRgb(cor: string): [number, number, number] {
  const match = /^#([\da-f]{6})$/i.exec(cor);
  if (!match?.[1]) return [113, 113, 113];
  return [
    Number.parseInt(match[1].slice(0, 2), 16),
    Number.parseInt(match[1].slice(2, 4), 16),
    Number.parseInt(match[1].slice(4, 6), 16),
  ];
}

function desenharCards(
  doc: JsPdf,
  y: number,
  margem: number,
  util: number,
  cards: Array<{ titulo: string; valor: string; nota: string }>,
): number {
  const gap = 3;
  const cardW = (util - gap * (cards.length - 1)) / cards.length;
  const cardH = 22;
  cards.forEach((card, index) => {
    const x = margem + index * (cardW + gap);
    doc.setFillColor(...COR.bg);
    doc.setDrawColor(...COR.linha);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COR.muted);
    doc.text(limpar(card.titulo), x + 3, y + 5.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(33, 33, 33);
    doc.text(limpar(card.valor), x + 3, y + 12.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(113, 113, 113);
    const notas = quebrar(doc, card.nota, cardW - 6, 2);
    notas.forEach((linha, i) => {
      doc.text(linha, x + 3, y + 17 + i * 3);
    });
  });
  doc.setTextColor(51, 51, 51);
  return y + cardH + 4;
}

type CardSocioPdf = {
  partnerId: string;
  trechos: number;
  linhas: Array<{ label: string; valor: string; bold?: boolean }>;
  total: number;
};

/** Cards por sócio iguais à tela: combustível / taxas ou litros / total. */
function desenharCardsSocios(
  doc: JsPdf,
  yInicial: number,
  margem: number,
  util: number,
  cards: CardSocioPdf[],
  filtroSocio: string | null,
  tituloPagina: string,
): number {
  if (cards.length === 0) return yInicial;

  const alturaPagina = doc.internal.pageSize.getHeight();
  const gap = 3;
  const porLinha = Math.min(3, cards.length);
  const cardW = (util - gap * (porLinha - 1)) / porLinha;
  const cardH = 28;
  let y = yInicial;

  const garantir = (necessario: number): number => {
    if (y + necessario <= alturaPagina - 12) return y;
    doc.addPage();
    cabecalhoPagina(doc, tituloPagina, margem);
    return yAposCabecalho();
  };

  y = garantir(8);
  doc.setDrawColor(...COR.linha);
  doc.setLineWidth(0.3);
  doc.line(margem, y, margem + util, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COR.muted);
  doc.text("TOTAIS POR SOCIO", margem, y);
  y += 4;

  cards.forEach((item, index) => {
    const col = index % porLinha;
    if (col === 0) {
      y = garantir(cardH + 4);
    }
    const x = margem + col * (cardW + gap);
    const ativo = filtroSocio === item.partnerId;
    const rgb = hexRgb(corDoSocio(item.partnerId));
    const soft = hexRgb(fundoCalendarioSocio(item.partnerId));
    const nome = limpar(partnerShort(item.partnerId));

    doc.setFillColor(...COR.branco);
    doc.setDrawColor(ativo ? rgb[0] : COR.linha[0], ativo ? rgb[1] : COR.linha[1], ativo ? rgb[2] : COR.linha[2]);
    doc.setLineWidth(ativo ? 1.1 : 0.4);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "FD");

    const pillW = Math.min(cardW * 0.42, doc.getTextWidth(nome) + 5);
    doc.setFillColor(soft[0], soft[1], soft[2]);
    doc.roundedRect(x + 2.5, y + 2.4, pillW, 5.2, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(nome, x + 4.2, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COR.muted);
    doc.text(
      limpar(`${item.trechos} trecho(s)${ativo ? " | filtrando" : ""}`),
      x + cardW - 3,
      y + 6,
      { align: "right" },
    );

    item.linhas.forEach((linha, i) => {
      const py = y + 12 + i * 4.8;
      if (i === item.linhas.length - 1) {
        doc.setDrawColor(...COR.linha);
        doc.setLineWidth(0.3);
        doc.line(x + 3, py - 2.2, x + cardW - 3, py - 2.2);
      }
      doc.setFont("helvetica", linha.bold ? "bold" : "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...(linha.bold ? COR.texto : COR.muted));
      doc.text(linha.label, x + 3, py);
      doc.setTextColor(...COR.texto);
      doc.text(limpar(linha.valor), x + cardW - 3, py, { align: "right" });
    });

    if (col === porLinha - 1 || index === cards.length - 1) {
      y += cardH + 3;
    }
  });

  doc.setTextColor(...COR.texto);
  doc.setDrawColor(...COR.linha);
  doc.setLineWidth(0.2);
  return y + 2;
}

function cardsSociosFifo(
  solicitantes: ConferenciaSolicitante[],
): CardSocioPdf[] {
  return solicitantes.map((item) => {
    const total = Math.round((item.combustivel + item.taxas) * 100) / 100;
    return {
      partnerId: item.partnerId,
      trechos: item.trechos,
      total,
      linhas: [
        { label: "Combustível", valor: formatBRL(item.combustivel) },
        { label: "Taxas", valor: formatBRL(item.taxas) },
        { label: "Total", valor: formatBRL(total), bold: true },
      ],
    };
  });
}

function cardsSociosVibra(
  solicitantes: ConferenciaVibraSolicitante[],
): CardSocioPdf[] {
  return solicitantes.map((item) => ({
    partnerId: item.partnerId,
    trechos: item.trechos,
    total: item.combustivel,
    linhas: [
      { label: "Combustível", valor: formatBRL(item.combustivel) },
      { label: "Litros", valor: formatLitros(item.litros) },
      { label: "Total", valor: formatBRL(item.combustivel), bold: true },
    ],
  }));
}

type ColunaPdf = {
  titulo: string;
  largura: number;
  align?: "left" | "right" | "center";
};

function linhasTituloColuna(doc: JsPdf, titulo: string, largura: number): string[] {
  const pad = 2.2;
  const util = Math.max(largura - pad, 6);
  const bruto = limpar(titulo).replace(/\n+/g, " ").trim();
  if (!bruto) return [""];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  const partes = doc.splitTextToSize(bruto, util) as string[];
  return partes.length > 0 ? partes.slice(0, 3) : [bruto];
}

function desenharCabecalhoTabela(
  doc: JsPdf,
  y: number,
  margem: number,
  colunas: ColunaPdf[],
  alturaLinha: number,
): number {
  const util = colunas.reduce((s, c) => s + c.largura, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  const blocos = colunas.map((col) => linhasTituloColuna(doc, col.titulo, col.largura));
  const maxLinhas = Math.max(1, ...blocos.map((linhas) => linhas.length));
  const passo = Math.max(alturaLinha - 0.2, 2.8);
  const altura = passo * maxLinhas + 3.4;

  doc.setFillColor(...COR.soft);
  doc.rect(margem, y - 3.2, util, altura, "F");
  doc.setFillColor(...COR.amarelo);
  doc.rect(margem, y - 3.2 + altura - 0.7, util, 0.7, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...COR.texto);
  let x = margem;
  colunas.forEach((col, index) => {
    const linhas = blocos[index] ?? [""];
    linhas.forEach((texto, i) => {
      const py = y + i * passo;
      if (col.align === "right") {
        doc.text(texto, x + col.largura - 1.2, py, { align: "right" });
      } else if (col.align === "center") {
        doc.text(texto, x + col.largura / 2, py, { align: "center" });
      } else {
        doc.text(texto, x + 1.1, py);
      }
    });
    x += col.largura;
  });
  return y + altura;
}

function desenharLinhaTabela(
  doc: JsPdf,
  y: number,
  margem: number,
  colunas: ColunaPdf[],
  celulas: BlocoCelula[],
  alturaLinha: number,
  fundo: [number, number, number] | null,
): number {
  const util = colunas.reduce((s, c) => s + c.largura, 0);
  const altura = Math.max(...celulas.map((c) => alturaBloco(c, alturaLinha)), alturaLinha + 2.2);
  if (fundo) {
    doc.setFillColor(fundo[0], fundo[1], fundo[2]);
    doc.rect(margem, y - 3.2, util, altura, "F");
  }
  let x = margem;
  celulas.forEach((celula, index) => {
    const col = colunas[index];
    if (!col) return;
    const pad = 1.1;
    let py = y;
    celula.linhas.forEach((linha) => {
      const texto = limpar(linha.texto).trim();
      if (texto) {
        doc.setFont("helvetica", linha.bold ? "bold" : "normal");
        const size = linha.size ?? 7.5;
        doc.setFontSize(size);
        const cor = linha.cor ?? COR.texto;
        if (linha.pill && linha.fundo && col.align !== "right") {
          const textoW = doc.getTextWidth(texto);
          const pillH = Math.max(3.6, size * 0.55);
          const pillX =
            col.align === "center"
              ? x + col.largura / 2 - (textoW + 2.4) / 2
              : x + pad - 0.6;
          doc.setFillColor(linha.fundo[0], linha.fundo[1], linha.fundo[2]);
          doc.roundedRect(pillX, py - pillH + 1.1, textoW + 2.4, pillH, 0.9, 0.9, "F");
        }
        doc.setTextColor(cor[0], cor[1], cor[2]);
        if (col.align === "right") {
          doc.text(texto, x + col.largura - pad, py, { align: "right" });
        } else if (col.align === "center") {
          doc.text(texto, x + col.largura / 2, py, { align: "center" });
        } else {
          doc.text(texto, x + pad, py);
        }
      }
      py += passoLinha(linha, alturaLinha);
    });
    x += col.largura;
  });
  doc.setTextColor(51, 51, 51);
  return y + altura;
}

function garantirEspaco(
  doc: JsPdf,
  y: number,
  necessario: number,
  margem: number,
  titulo: string,
  colunas: ColunaPdf[],
  alturaLinha: number,
): number {
  const altura = doc.internal.pageSize.getHeight();
  if (y + necessario <= altura - 12) return y;
  doc.addPage();
  cabecalhoPagina(doc, titulo, margem);
  let ny = yAposCabecalho();
  ny = desenharCabecalhoTabela(doc, ny, margem, colunas, alturaLinha);
  return ny;
}

function blocoVibra(linha: ConferenciaVibraLinha, colunas: ColunaPdf[], doc: JsPdf): BlocoCelula[] {
  const socioTexto = linha.rateioParticipacao
    ? "Participacao"
    : partnerShort(linha.partnerId);
  const socioCor = linha.rateioParticipacao
    ? COR.texto
    : hexRgb(corDoSocio(linha.partnerId));
  const socioFundo = linha.rateioParticipacao
    ? COR.bg
    : hexRgb(fundoCalendarioSocio(linha.partnerId));
  const abastecido = linha.abastecimentoId != null;
  const larguraTrecho = (colunas[1]?.largura ?? 60) - 3;
  const trechoLinhas = quebrar(doc, linha.route, larguraTrecho, 3).map((texto, index) => ({
    texto,
    bold: index === 0,
    size: index === 0 ? 7.5 : 6.8,
  }));

  const checagem: LinhaCelula[] = [
    {
      texto: rotuloStatusLinha(linha.status),
      bold: true,
      cor: corStatus(linha.status),
      fundo: fundoStatus(linha.status),
      pill: true,
      size: 7.5,
      gapApos: 0.6,
    },
  ];
  if (linha.saldoAposTrecho != null) {
    checagem.push({
      texto:
        linha.saldoAposTrecho > 1
          ? `Sobram ${formatLitros(linha.saldoAposTrecho)}`
          : "NF sem saldo",
      size: 6.5,
      cor: COR.muted,
    });
  }
  for (const pedaco of quebrar(doc, linha.detalhe, (colunas[9]?.largura ?? 32) - 3, 2)) {
    if (pedaco) checagem.push({ texto: pedaco, size: 6.5, cor: COR.muted });
  }

  return [
    { linhas: [{ texto: formatDate(linha.date), bold: true }] },
    { linhas: trechoLinhas.length > 0 ? trechoLinhas : [{ texto: "-", bold: true }] },
    {
      linhas: [
        {
          texto: linha.blockHours > 0 ? formatHours(linha.blockHours) : "-",
        },
      ],
    },
    {
      linhas: [
        {
          texto: linha.litrosCalc > 0 ? formatLitros(linha.litrosCalc) : "-",
          cor: COR.muted,
        },
      ],
    },
    {
      linhas: [
        {
          texto: socioTexto,
          bold: true,
          cor: socioCor,
          fundo: socioFundo,
          pill: true,
        },
      ],
    },
    {
      linhas: [
        {
          texto: abastecido ? "Sim" : "Nao",
          bold: true,
          cor: abastecido ? [21, 128, 61] : COR.muted,
          fundo: abastecido ? [236, 253, 243] : COR.bg,
          pill: true,
        },
      ],
    },
    {
      linhas: linha.referencia
        ? [
            { texto: `Ref. ${linha.referencia}`, bold: true },
            {
              texto: `${linha.icao ?? "-"}${linha.abastDate ? ` | ${formatDate(linha.abastDate)}` : ""}`,
              size: 6.5,
              cor: COR.muted,
            },
          ]
        : [{ texto: "-", cor: COR.muted }],
    },
    {
      linhas: [
        {
          texto: linha.litrosAbast != null ? formatLitros(linha.litrosAbast) : "-",
          bold: linha.litrosAbast != null,
        },
      ],
    },
    {
      linhas:
        linha.amount != null
          ? [
              { texto: limpar(formatBRL(linha.amount)), bold: true },
              {
                texto: formatPrecoLitro(linha.precoLitro),
                size: 6.5,
                cor: COR.muted,
              },
            ]
          : [{ texto: "-", cor: COR.muted }],
    },
    { linhas: checagem },
  ];
}

export async function baixarPdfConferenciaVibra(params: {
  months: MonthFilter;
  aircraftId: string;
  dados: ConferenciaVibraPorData;
  linhas: ConferenciaVibraLinha[];
}): Promise<void> {
  const { months, aircraftId, dados, linhas } = params;
  const doc = await criarDoc();
  const margem = 8;
  const largura = doc.internal.pageSize.getWidth();
  const util = largura - margem * 2;
  const alturaLinha = 3.2;
  const titulo = "Vibra · abastecimentos";
  const subtitulo = `${monthsLabel(months)} · ${escopo(aircraftId)} · posição em ${formatDate(HOJE)}`;

  const colunas: ColunaPdf[] = [
    { titulo: "Data", largura: util * 0.06 },
    { titulo: "Trecho", largura: util * 0.17 },
    { titulo: "Tempo de Voo", largura: util * 0.07, align: "right" },
    { titulo: "Consumo Previsto (LT)", largura: util * 0.09, align: "center" },
    { titulo: "Socio", largura: util * 0.07, align: "center" },
    { titulo: "Abastecido?", largura: util * 0.08, align: "center" },
    { titulo: "NF alocada", largura: util * 0.1, align: "center" },
    { titulo: "Litros NF", largura: util * 0.08, align: "right" },
    { titulo: "Valor NF", largura: util * 0.1, align: "right" },
    { titulo: "Checagem", largura: util * 0.18 },
  ];

  cabecalhoPagina(doc, null, margem);
  let y = yAposCabecalho();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COR.texto);
  doc.text(limpar(titulo), margem, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COR.muted);
  doc.text(limpar(subtitulo), margem, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COR.muted);
  doc.text("VOO x ABASTECIMENTO", margem, y);
  y += 4;

  y = desenharCards(doc, y, margem, util, [
    {
      titulo: "Trechos",
      valor: String(dados.linhas.length),
      nota: dados.semAbast > 0 ? `${dados.semAbast} sem abast.` : "todos alocados",
    },
    {
      titulo: "Comprovantes",
      valor: formatBRL(dados.totalValor),
      nota: `${dados.totalAbastecimentos} abast. | ${formatLitros(dados.totalLitros)}`,
    },
    {
      titulo: "NFs com trecho",
      valor: String(dados.comVoo),
      nota: `${dados.semVoo} NF(s) ainda sem trecho`,
    },
    {
      titulo: "R$/L mediano",
      valor: formatPrecoLitro(dados.precoLitroMediano),
      nota: dados.atencao > 0 ? `${dados.atencao} em atencao` : "alocacao manual",
    },
  ]);

  if (dados.notasSemComprovante.length > 0) {
    const avisoH = 8 + dados.notasSemComprovante.length * 3.4;
    doc.setFillColor(255, 251, 245);
    doc.setDrawColor(245, 230, 211);
    doc.roundedRect(margem, y, util, avisoH, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(139, 94, 60);
    doc.text(
      limpar(
        `Diferença ${formatBRL(dados.totalFaturadoPeriodo - dados.totalValor)} · ${dados.notasSemComprovante.length} NF(s) sem comprovante na pasta`,
      ),
      margem + 3,
      y + 5,
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(113, 113, 113);
    dados.notasSemComprovante.forEach((nota, i) => {
      doc.text(
        limpar(
          `NF ${nota.numero}${nota.referencia ? ` · ref. ${nota.referencia}` : ""} · ${formatDate(nota.date)} · ${formatBRL(nota.amount)}`,
        ),
        margem + 3,
        y + 9 + i * 3.4,
      );
    });
    y += avisoH + 4;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(113, 113, 113);
  doc.text(
    limpar(
      "Ordem dos voos importados. Abastecimento por alocacao manual trecho x NF Vibra.",
    ),
    margem,
    y,
  );
  y += 5;

  y = desenharCardsSocios(
    doc,
    y,
    margem,
    util,
    cardsSociosVibra(dados.porSolicitante),
    null,
    titulo,
  );

  y = desenharCabecalhoTabela(doc, y, margem, colunas, alturaLinha);

  if (linhas.length === 0) {
    y = desenharLinhaTabela(
      doc,
      y,
      margem,
      colunas,
      [
        { linhas: [{ texto: "Nenhum trecho neste recorte." }] },
        ...colunas.slice(1).map(() => ({ linhas: [{ texto: "" }] })),
      ],
      alturaLinha,
      null,
    );
  } else {
    for (const linha of linhas) {
      const celulas = blocoVibra(linha, colunas, doc);
      const necessario = Math.max(...celulas.map((c) => alturaBloco(c, alturaLinha)));
      y = garantirEspaco(doc, y, necessario, margem, titulo, colunas, alturaLinha);
      const fundo: [number, number, number] | null =
        linha.matchTipo === "vizinho"
          ? [247, 250, 255]
          : linha.matchTipo === "elo"
            ? [247, 248, 249]
            : null;
      y = desenharLinhaTabela(doc, y, margem, colunas, celulas, alturaLinha, fundo);
    }

    const vistosNf = new Set<string>();
    let litrosNf = 0;
    let valorNf = 0;
    for (const item of linhas) {
      if (!item.abastecimentoId || vistosNf.has(item.abastecimentoId)) continue;
      vistosNf.add(item.abastecimentoId);
      litrosNf += item.litrosAbast ?? 0;
      valorNf += item.amount ?? 0;
    }

    y = garantirEspaco(doc, y, 8, margem, titulo, colunas, alturaLinha);
    y = desenharLinhaTabela(
      doc,
      y,
      margem,
      colunas,
      [
        {
          linhas: [
            {
              texto: `Total | ${linhas.length} trecho(s)`,
              bold: true,
            },
          ],
        },
        { linhas: [{ texto: "" }] },
        { linhas: [{ texto: "" }] },
        { linhas: [{ texto: "" }] },
        { linhas: [{ texto: "" }] },
        { linhas: [{ texto: "" }] },
        { linhas: [{ texto: "" }] },
        {
          linhas: [{ texto: formatLitros(litrosNf), bold: true }],
        },
        {
          linhas: [{ texto: formatBRL(valorNf), bold: true }],
        },
        { linhas: [{ texto: "" }] },
      ],
      alturaLinha,
      [244, 244, 242],
    );
  }

  const anexos = listarAnexosVibra(linhas);
  if (anexos.length > 0) {
    y = garantirEspaco(doc, y, 14, margem, titulo, colunas, alturaLinha);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COR.texto);
    doc.text(
      limpar(`Anexos: ${anexos.length} comprovante(s) de abastecimento ao final deste PDF.`),
      margem,
      y,
    );
  }

  rodape(doc, margem);
  const relatorio = new Uint8Array(doc.output("arraybuffer"));
  const blob = await mesclarComAnexosVibra(relatorio, anexos);
  baixarBlob(`conferencia-vibra-${monthsLabel(months).replace(/\s+/g, "-").toLowerCase()}.pdf`, blob);
}

export async function baixarPdfConferenciaPrestacao(params: {
  months: MonthFilter;
  aircraftId: string;
  dados: ConferenciaPrestacao;
  linhas: ConferenciaLinha[];
  filtroSocio: string | null;
}): Promise<void> {
  const { months, aircraftId, dados, linhas, filtroSocio } = params;
  const doc = await criarDoc();
  const margem = 8;
  const largura = doc.internal.pageSize.getWidth();
  const util = largura - margem * 2;
  const alturaLinha = 3.2;
  const titulo = "Prestação de contas";
  const socioLabel = filtroSocio ? ` · ${partnerShort(filtroSocio)}` : "";
  const subtitulo = `${monthsLabel(months)} · ${escopo(aircraftId)}${socioLabel} · posição em ${formatDate(HOJE)}`;

  const colunas: ColunaPdf[] = [
    { titulo: "DATA", largura: util * 0.08 },
    { titulo: "TRECHO", largura: util * 0.2 },
    { titulo: "TEMPO", largura: util * 0.07, align: "right" },
    { titulo: "LITROS", largura: util * 0.08, align: "right" },
    { titulo: "SÓCIO", largura: util * 0.12 },
    { titulo: "COMBUSTÍVEL", largura: util * 0.11, align: "right" },
    { titulo: "NF VIBRA", largura: util * 0.1 },
    { titulo: "TAXAS", largura: util * 0.1, align: "right" },
    { titulo: "NF TAXAS", largura: util * 0.14 },
  ];

  const vibra = dados.combustivel;
  const taxas = dados.taxas;
  const totalDespesas = dados.totalNotas;
  const totalDistribuido = dados.totalDistribuido;
  const saldo = Math.max(0, Math.round((totalDespesas - totalDistribuido) * 100) / 100);
  const fechado = saldo <= 0.02 && totalDespesas > 0;
  const totalComb =
    Math.round(
      linhas.reduce((soma, linha) => soma + (linha.combNaNf ? linha.combCalculo : 0), 0) * 100,
    ) / 100;
  const totalTaxas =
    Math.round(linhas.reduce((soma, linha) => soma + linha.taxasCalculo, 0) * 100) / 100;

  cabecalhoPagina(doc, null, margem);
  let y = yAposCabecalho();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COR.texto);
  doc.text(limpar(titulo), margem, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COR.muted);
  doc.text(limpar(subtitulo), margem, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COR.muted);
  doc.text("DESPESAS | NOTAS x TRECHOS", margem, y);
  y += 4;

  y = desenharCards(doc, y, margem, util, [
    {
      titulo: "Combustível · Vibra",
      valor: formatBRL(vibra.valor),
      nota: `${vibra.quantidade} NF(s)${vibra.distribuido > 0 ? ` · nos trechos ${formatBRL(vibra.distribuido)}` : ""}`,
    },
    {
      titulo: "Taxas aeroportuárias",
      valor: formatBRL(taxas.valor > 0 ? taxas.valor : taxas.distribuido),
      nota: `${taxas.quantidade > 0 ? `${taxas.quantidade} NF(s)` : "nos trechos"}${taxas.distribuido > 0 ? ` · ${formatBRL(taxas.distribuido)}` : ""}`,
    },
    {
      titulo: "Total despesas",
      valor: formatBRL(totalDespesas > 0 ? totalDespesas : vibra.valor + taxas.distribuido),
      nota: fechado
        ? `distribuído ${formatBRL(totalDistribuido)} · conferência fechada`
        : saldo > 0.009
          ? `distribuído ${formatBRL(totalDistribuido)} · saldo ${formatBRL(saldo)}`
          : `distribuído ${formatBRL(totalDistribuido)}`,
    },
  ]);

  const trechosNota = [
    `${linhas.length} trecho(s)${filtroSocio ? ` · filtro ${partnerShort(filtroSocio)}` : " no período"}`,
    vibra.litrosDistribuidos > 0 && !filtroSocio
      ? `${formatLitros(vibra.litrosDistribuidos)} de combustível rateados`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(113, 113, 113);
  doc.text(limpar(trechosNota), margem, y);
  y += 5;

  y = desenharCardsSocios(
    doc,
    y,
    margem,
    util,
    cardsSociosFifo(dados.porSolicitante),
    filtroSocio,
    titulo,
  );

  y = desenharCabecalhoTabela(doc, y, margem, colunas, alturaLinha);

  const celulaPrestacao = (linha: ConferenciaLinha): BlocoCelula[] => [
    { linhas: [{ texto: formatDate(linha.date), bold: true }] },
    { linhas: [{ texto: rotaCurtaPdf(linha.route), bold: true }] },
    {
      linhas: [
        {
          texto: linha.blockHours > 0 ? formatHours(linha.blockHours) : "—",
        },
      ],
    },
    {
      linhas: [
        {
          texto: linha.litros > 0 ? formatLitros(linha.litros) : "—",
          cor: [113, 113, 113],
        },
      ],
    },
    {
      linhas: [
        (() => {
          const texto =
            linha.rateioParticipacao && !filtroSocio
              ? rotuloParticipacao(linha.aircraftId)
              : `${partnerShort(linha.partnerId)}${linha.rateioParticipacao ? " | cota" : ""}`;
          const comSocio = !(linha.rateioParticipacao && !filtroSocio);
          return {
            texto,
            bold: true,
            cor: comSocio ? hexRgb(corDoSocio(linha.partnerId)) : COR.texto,
            fundo: comSocio ? hexRgb(fundoCalendarioSocio(linha.partnerId)) : COR.bg,
            pill: true,
          } satisfies LinhaCelula;
        })(),
      ],
    },
    {
      linhas: [
        {
          texto: linha.combCalculo > 0 ? formatBRL(linha.combCalculo) : "—",
          bold: true,
        },
      ],
    },
    {
      linhas:
        linha.combNotas.length > 0
          ? linha.combNotas.map((nota) => ({ texto: nota.numero, bold: true, size: 7 }))
          : [{ texto: "—", cor: [113, 113, 113] as [number, number, number] }],
    },
    {
      linhas: [
        {
          texto: linha.taxasCalculo > 0 ? formatBRL(linha.taxasCalculo) : "—",
          bold: true,
        },
      ],
    },
    {
      linhas:
        linha.taxasNotas.length > 0
          ? linha.taxasNotas.map((nota) => ({ texto: nota.numero, bold: true, size: 7 }))
          : [{ texto: "—", cor: [113, 113, 113] as [number, number, number] }],
    },
  ];

  if (linhas.length === 0) {
    y = desenharLinhaTabela(
      doc,
      y,
      margem,
      colunas,
      [
        {
          linhas: [
            {
              texto: filtroSocio
                ? `Nenhum trecho de ${partnerShort(filtroSocio)} neste recorte.`
                : "Nenhum trecho neste recorte.",
            },
          ],
        },
        ...colunas.slice(1).map(() => ({ linhas: [{ texto: "" }] })),
      ],
      alturaLinha,
      null,
    );
  } else {
    for (const linha of linhas) {
      const celulas = celulaPrestacao(linha);
      const necessario = Math.max(...celulas.map((c) => alturaBloco(c, alturaLinha)));
      y = garantirEspaco(doc, y, necessario, margem, titulo, colunas, alturaLinha);
      y = desenharLinhaTabela(doc, y, margem, colunas, celulas, alturaLinha, null);
    }
    y = garantirEspaco(doc, y, 8, margem, titulo, colunas, alturaLinha);
    y = desenharLinhaTabela(
      doc,
      y,
      margem,
      colunas,
      [
        {
          linhas: [
            {
              texto: `Total · ${linhas.length} trecho(s)${filtroSocio ? ` · ${partnerShort(filtroSocio)}` : ""}`,
              bold: true,
            },
          ],
        },
        { linhas: [{ texto: "" }] },
        { linhas: [{ texto: "" }] },
        { linhas: [{ texto: "" }] },
        { linhas: [{ texto: "" }] },
        { linhas: [{ texto: formatBRL(totalComb), bold: true }] },
        { linhas: [{ texto: "" }] },
        {
          linhas: [
            {
              texto: totalTaxas > 0 ? formatBRL(totalTaxas) : "—",
              bold: true,
            },
          ],
        },
        { linhas: [{ texto: "" }] },
      ],
      alturaLinha,
      [244, 244, 242],
    );
  }

  rodape(doc, margem);
  const blob = doc.output("blob");
  baixarBlob(
    `conferencia-prestacao-${monthsLabel(months).replace(/\s+/g, "-").toLowerCase()}.pdf`,
    blob,
  );
}
