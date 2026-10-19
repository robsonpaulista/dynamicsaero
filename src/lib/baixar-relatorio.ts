import { formatDate } from "@/lib/format";
import { HOJE } from "@/data/calendario";
import type { Celula, Planilha, Relatorio } from "@/services/relatorios-rateio";

function hexRgb(cor: string): [number, number, number] | null {
  const match = /^#([\da-f]{6})$/i.exec(cor);
  if (!match?.[1]) return null;
  return [
    Number.parseInt(match[1].slice(0, 2), 16),
    Number.parseInt(match[1].slice(2, 4), 16),
    Number.parseInt(match[1].slice(4, 6), 16),
  ];
}

function xml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function moedaArquivo(valor: number): string {
  const texto = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
  return `R$ ${texto.replace(/\u00a0/g, " ")}`;
}

function textoPdf(valor: string): string {
  return valor.replace(/\u2014/g, "-").replace(/\u00a0/g, " ");
}

function celulaTexto(valor: Celula): string {
  if (valor === null || valor === "") return "";
  if (typeof valor === "number") return moedaArquivo(valor);
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return formatDate(valor);
  return valor;
}

function celulaXml(valor: Celula, negrito: boolean, cor: string | null): string {
  const colorido = valor !== null && valor !== "";
  const tom = colorido && cor === "#EF4444" ? "debito" : colorido && cor === "#334155" ? "credito" : "";
  const estilo = tom
    ? `${tom}${negrito ? "Negrito" : ""}`
    : negrito
      ? typeof valor === "number"
        ? "negritoMoeda"
        : "negrito"
      : typeof valor === "number"
        ? "moeda"
        : "";
  const estiloAttr = estilo ? ` ss:StyleID="${estilo}"` : "";
  if (valor === null || valor === "") {
    return `<Cell${estiloAttr}><Data ss:Type="String"></Data></Cell>`;
  }
  if (typeof valor === "number") {
    return `<Cell${estiloAttr}><Data ss:Type="Number">${valor}</Data></Cell>`;
  }
  const texto = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? formatDate(valor) : valor;
  return `<Cell${estiloAttr}><Data ss:Type="String">${xml(texto)}</Data></Cell>`;
}

function baixarBlob(nome: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

function planilhaXml(planilha: Planilha): string {
  const cabecalho = planilha.notas
    .map((nota) => `<Row><Cell ss:MergeAcross="${Math.max(planilha.colunas.length - 1, 0)}"><Data ss:Type="String">${xml(nota)}</Data></Cell></Row>`)
    .join("");
  const titulo = `<Row><Cell ss:StyleID="titulo" ss:MergeAcross="${Math.max(planilha.colunas.length - 1, 0)}"><Data ss:Type="String">${xml(planilha.titulo)}</Data></Cell></Row>`;
  const colunas = `<Row>${planilha.colunas
    .map((coluna, indice) => {
      const cor = planilha.cores?.[indice];
      const estilo = cor === "#EF4444" ? "cabecaDebito" : cor === "#334155" ? "cabecaCredito" : "cabeca";
      return `<Cell ss:StyleID="${estilo}"><Data ss:Type="String">${xml(coluna)}</Data></Cell>`;
    })
    .join("")}</Row>`;
  const linhas = planilha.linhas
    .map((linha, indice) => {
      const negrito = planilha.negrito?.[indice] ?? false;
      const celulas = linha.map((valor, coluna) => celulaXml(valor, negrito, planilha.cores?.[coluna] ?? null)).join("");
      return `<Row>${celulas}</Row>`;
    })
    .join("");

  return `<Worksheet ss:Name="${xml(planilha.nome)}"><Table>${titulo}${cabecalho}<Row/>${colunas}${linhas}</Table></Worksheet>`;
}

export function baixarExcel(relatorio: Relatorio): void {
  const xmlDoc = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
<Style ss:ID="titulo"><Font ss:Bold="1" ss:Size="14"/></Style>
<Style ss:ID="cabeca"><Font ss:Bold="1"/><Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/></Style>
<Style ss:ID="moeda"><NumberFormat ss:Format="#,##0.00"/></Style>
<Style ss:ID="negrito"><Font ss:Bold="1"/></Style>
<Style ss:ID="negritoMoeda"><Font ss:Bold="1"/><NumberFormat ss:Format="#,##0.00"/></Style>
<Style ss:ID="debito"><Font ss:Color="#EF4444"/><NumberFormat ss:Format="#,##0.00"/></Style>
<Style ss:ID="debitoNegrito"><Font ss:Bold="1" ss:Color="#EF4444"/><NumberFormat ss:Format="#,##0.00"/></Style>
<Style ss:ID="credito"><Font ss:Color="#334155"/><NumberFormat ss:Format="#,##0.00"/></Style>
<Style ss:ID="creditoNegrito"><Font ss:Bold="1" ss:Color="#334155"/><NumberFormat ss:Format="#,##0.00"/></Style>
<Style ss:ID="cabecaDebito"><Font ss:Bold="1" ss:Color="#EF4444"/><Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/></Style>
<Style ss:ID="cabecaCredito"><Font ss:Bold="1" ss:Color="#334155"/><Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/></Style>
</Styles>
${relatorio.planilhas.map(planilhaXml).join("")}
</Workbook>`;
  baixarBlob(
    `${relatorio.arquivo}.xls`,
    new Blob([xmlDoc], { type: "application/vnd.ms-excel;charset=utf-8" }),
  );
}

export async function baixarPdf(relatorio: Relatorio): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const largo = relatorio.planilhas.some((item) => item.colunas.length > 6);
  const doc = new jsPDF({ orientation: largo ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const margem = 12;

  const novaPagina = (continuacao: boolean) => {
    doc.setFillColor(235, 180, 2);
    doc.rect(0, 0, largura, 14, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("DYNAMICS AERO", margem, 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(textoPdf(continuacao ? relatorio.titulo : "Ventura Aviação"), largura - margem, 9, {
      align: "right",
    });
    doc.setTextColor(51, 51, 51);
  };

  let y = 22;
  novaPagina(false);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(textoPdf(relatorio.titulo), margem, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(113, 113, 113);
  doc.text(textoPdf(`${relatorio.subtitulo} · posição em ${formatDate(HOJE)}`), margem, y);
  doc.setTextColor(51, 51, 51);
  y += 8;

  const desenharPlanilha = (planilha: Planilha) => {
    if (y > altura - 36) {
      doc.addPage();
      novaPagina(true);
      y = 22;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(textoPdf(planilha.titulo), margem, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(113, 113, 113);
    for (const nota of planilha.notas) {
      doc.text(textoPdf(nota), margem, y);
      y += 4;
    }
    doc.setTextColor(51, 51, 51);
    y += 2;

    const pesos =
      planilha.larguras?.length === planilha.colunas.length
        ? planilha.larguras
        : planilha.colunas.map(() => 1);
    const somaPesos = pesos.reduce((total, peso) => total + peso, 0) || 1;
    const largurasColuna = pesos.map((peso) => ((largura - margem * 2) * peso) / somaPesos);
    const alinhamento = planilha.colunas.map(
      (_, index) => planilha.alinhamento?.[index] ?? "inicio",
    );

    const escreverLinha = (valores: string[], negrito: boolean, fundo: "cabeca" | "destaque" | false) => {
      const blocos = valores.map((valor, index) => {
        const texto = textoPdf(valor);
        if (!texto) return [""];
        const quebrado = doc.splitTextToSize(texto, Math.max((largurasColuna[index] ?? 8) - 2, 8));
        return (Array.isArray(quebrado) ? quebrado : [String(quebrado)]) as string[];
      });
      const quantidade = Math.max(1, ...blocos.map((item) => item.length));
      const alturaCaixa = quantidade * 3.5 + 2.2;
      if (y + alturaCaixa > altura - 12) {
        doc.addPage();
        novaPagina(true);
        y = 22;
        if (fundo !== "cabeca") escreverLinha(planilha.colunas, true, "cabeca");
      }
      if (fundo === "cabeca") {
        doc.setFillColor(255, 248, 214);
        doc.rect(margem, y - 3.6, largura - margem * 2, alturaCaixa, "F");
      } else if (fundo === "destaque") {
        doc.setFillColor(244, 244, 242);
        doc.rect(margem, y - 3.6, largura - margem * 2, alturaCaixa, "F");
      }
      doc.setFont("helvetica", negrito || fundo === "cabeca" ? "bold" : "normal");
      doc.setFontSize(8);
      blocos.forEach((linhasTexto, index) => {
        const cor = planilha.cores?.[index];
        const rgb = linhasTexto.some((linha) => linha.trim()) ? (cor ? hexRgb(cor) : null) : null;
        doc.setTextColor(rgb?.[0] ?? 51, rgb?.[1] ?? 51, rgb?.[2] ?? 51);
        const x = margem + largurasColuna.slice(0, index).reduce((total, item) => total + item, 0);
        const larguraColuna = largurasColuna[index] ?? 0;
        linhasTexto.forEach((linhaTexto, linhaIndex) => {
          const posicaoY = y + linhaIndex * 3.5;
          if (alinhamento[index] === "fim") {
            doc.text(linhaTexto, x + larguraColuna - 1, posicaoY, { align: "right" });
          } else {
            doc.text(linhaTexto, x + 1, posicaoY);
          }
        });
      });
      doc.setTextColor(51, 51, 51);
      y += alturaCaixa;
    };

    escreverLinha(planilha.colunas, true, "cabeca");
    if (planilha.linhas.length === 0) {
      escreverLinha(["Nenhum lançamento neste recorte."], false, false);
      y += 4;
      return;
    }
    planilha.linhas.forEach((linha, indice) => {
      const destaque = planilha.negrito?.[indice] ?? false;
      escreverLinha(
        linha.map((valor) => celulaTexto(valor)),
        destaque,
        destaque ? "destaque" : false,
      );
    });
    y += 6;
  };

  for (const planilha of relatorio.planilhas) desenharPlanilha(planilha);

  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(113, 113, 113);
    doc.text(`Página ${pagina} de ${paginas}`, largura - margem, altura - 6, { align: "right" });
  }

  doc.save(`${relatorio.arquivo}.pdf`);
}
