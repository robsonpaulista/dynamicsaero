#!/usr/bin/env python3
"""Extrai comprovantes individuais de abastecimento Vibra e casa com o faturamento."""

from __future__ import annotations

import html as htmlmod
import json
import re
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "notas-abastecimento"
HTM = ROOT / "public" / "anexos" / "nf" / "vibra-documentos-faturamento.htm"
OUT = ROOT / "src" / "data" / "abastecimentos-vibra.json"


def ler_faturamento() -> dict[str, dict]:
    htm = HTM.read_text(encoding="utf-8", errors="ignore")
    vals = re.findall(r"<nobr[^>]*>(.*?)</nobr>", htm, flags=re.I | re.S)
    clean: list[str] = []
    for raw in vals:
        texto = re.sub(r"<[^>]+>", "", raw)
        texto = htmlmod.unescape(texto.replace("&nbsp;", " ")).strip()
        if texto:
            clean.append(texto)

    por_ref: dict[str, dict] = {}
    i = 0
    while i < len(clean):
        if re.fullmatch(r"1009\d{6}", clean[i]):
            chunk = clean[i : i + 12]
            if (
                len(chunk) >= 3
                and re.fullmatch(r"0+\d{5,6}", chunk[1])
                and re.fullmatch(r"1000\d{6}", chunk[2])
            ):
                window = clean[i : i + 15]
                date = next((x for x in window if re.fullmatch(r"\d{2}\.\d{2}\.\d{4}", x)), None)
                amount = next((x for x in window if re.fullmatch(r"[\d.]+,\d{2}", x)), None)
                if date and amount:
                    d, mo, y = date.split(".")
                    ref = str(int(chunk[1]))
                    por_ref[ref] = {
                        "atribuicao": chunk[0],
                        "referencia": ref,
                        "numero": chunk[2],
                        "date": f"{y}-{mo}-{d}",
                        "amount": float(amount.replace(".", "").replace(",", ".")),
                    }
        i += 1
    return por_ref


def parse_pdf(path: Path) -> dict | None:
    if "(2)" in path.name:
        return None
    texto = "\n".join((page.extract_text() or "") for page in PdfReader(str(path)).pages)
    m_ref = re.search(r"NF\s+(\d+)", path.name)
    aero = re.search(r"AEROPORTO\s*\n\s*([A-Z0-9]{4})", texto)
    data = re.search(r"DATA\s*\n\s*(\d{2}/\d{2}/\d{4})", texto)
    vol = re.search(r"VOLUME:\s*\n?\s*(\d+)", texto)
    numero = re.search(r"NÚMERO\s*\n\s*(\d+)", texto)
    dens = re.search(r"DENSIDADE:\s*\n?\s*([\d,]+)", texto)
    cidades = re.findall(r"CIDADE:\s*\n\s*([^\n]+)", texto)
    dest = re.search(r"DESTINO:\s*\n\s*(\S+)", texto)
    if not m_ref or not data or not vol or not aero:
        print("skip", path.name)
        return None
    d, mo, y = data.group(1).split("/")
    destino = dest.group(1) if dest else None
    if destino and not re.fullmatch(r"[A-Z0-9]{4}", destino):
        destino = None
    return {
        "id": f"abast-{m_ref.group(1)}",
        "referencia": m_ref.group(1),
        "numeroEntrega": numero.group(1) if numero else None,
        "date": f"{y}-{mo}-{d}",
        "icao": aero.group(1),
        "cidade": cidades[0].strip().title() if cidades else None,
        "destinoIcao": destino,
        "litros": int(vol.group(1)),
        "densidade": float(dens.group(1).replace(",", ".")) if dens else None,
        "arquivo": path.name,
        "anexoUrl": f"/anexos/abastecimentos/{path.name}",
    }


def main() -> None:
    faturamento = ler_faturamento()
    itens: list[dict] = []
    for path in sorted(PDF_DIR.glob("*.pdf")):
        item = parse_pdf(path)
        if not item:
            continue
        fatura = faturamento.get(item["referencia"])
        if fatura:
            item["notaNumero"] = fatura["numero"]
            item["notaDate"] = fatura["date"]
            item["notaAmount"] = fatura["amount"]
            item["notaAtribuicao"] = fatura["atribuicao"]
        else:
            item["notaNumero"] = None
            item["notaDate"] = None
            item["notaAmount"] = None
            item["notaAtribuicao"] = None
        itens.append(item)

    itens.sort(key=lambda item: (item["date"], item["referencia"]))
    OUT.write_text(json.dumps(itens, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    matched = sum(1 for item in itens if item["notaNumero"])
    print(
        json.dumps(
            {
                "abastecimentos": len(itens),
                "comFatura": matched,
                "litros": sum(item["litros"] for item in itens),
                "valorFaturado": round(
                    sum(item["notaAmount"] or 0 for item in itens),
                    2,
                ),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    print("wrote", OUT)


if __name__ == "__main__":
    main()
