#!/usr/bin/env python3
"""Importa a base JSA a partir dos 3 PDFs de relatório de etapas (sem inventar provisionado)."""

from __future__ import annotations

import json
import re
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT  # PDFs colados na raiz
AVIOES = ROOT / "avioes"
OUT = ROOT / "src" / "data" / "caso-jsa.json"
NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

PDFS = [
    ("Relatório de etapas de voo - HUMBERTO.pdf", "humberto", "Humberto Júnior"),
    ("Relatório de etapas de voo - JADYEL.pdf", "jadyel", "Jadyel Alencar"),
    ("Relatório de etapas de voo - RUAN.pdf", "ruan", "Ruan Prado"),
]

PAT = re.compile(
    r"^(\d+)\s+(.+?)\s+\(([A-Z0-9]{4})\)\s+(.+?)\s+\(([A-Z0-9]{4})\)\s+"
    r"(\d{2}/\d{2}/\d{4})\s+(\d{2}:\d{2})\s+PS-JSA\s+(.+)$"
)

# Em etapas compartilhadas (mesmo ID em mais de um PDF), Humberto tem prioridade
# no solicitante — alinhado ao trecho Goiânia/Brasília de janeiro.
PARTNER_RANK = {"humberto": 0, "ruan": 1, "jadyel": 2}


def limpar_cidade(texto: str) -> str:
    return re.sub(r"\s*-\s*[A-Z]{2}$", "", texto.strip()).strip()


def tempo_para_horas(tempo: str) -> float:
    hh, mm = map(int, tempo.split(":"))
    return round(hh + mm / 60, 2)


def chegar(depart: str, horas: float) -> str:
    dh, dm = map(int, depart.split(":"))
    total = dh * 60 + dm + int(round(horas * 60))
    return f"{total // 60:02d}:{total % 60:02d}"


def escolher_solicitante(partners: list[str]) -> str:
    unicos = sorted(set(partners), key=lambda p: PARTNER_RANK.get(p, 99))
    return unicos[0]


def ler_pdfs() -> tuple[dict, dict]:
    """Retorna meta por id de etapa e partners por id."""
    meta: dict[str, dict] = {}
    owners: dict[str, list[str]] = defaultdict(list)

    for nome_arquivo, partner_id, _nome in PDFS:
        path = PDF_DIR / nome_arquivo
        if not path.exists():
            path = AVIOES / nome_arquivo
        if not path.exists():
            raise FileNotFoundError(nome_arquivo)

        from pypdf import PdfReader

        texto = "\n".join((page.extract_text() or "") for page in PdfReader(str(path)).pages)
        for linha in texto.splitlines():
            linha = " ".join(linha.split())
            m = PAT.match(linha)
            if not m:
                continue
            lid, from_city, from_icao, to_city, to_icao, date_br, tempo, _op = m.groups()
            d, mo, y = date_br.split("/")
            date_iso = f"{y}-{mo}-{d}"
            hours = tempo_para_horas(tempo)
            if lid not in meta:
                meta[lid] = {
                    "sourceId": lid,
                    "fromIcao": from_icao,
                    "toIcao": to_icao,
                    "fromCity": limpar_cidade(from_city),
                    "toCity": limpar_cidade(to_city),
                    "date": date_iso,
                    "blockHours": hours,
                    "tempo": tempo,
                }
            if partner_id not in owners[lid]:
                owners[lid].append(partner_id)

    return meta, owners


def shared_strings(z: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    out: list[str] = []
    for si in root.findall("a:si", NS):
        out.append("".join(t.text or "" for t in si.findall(".//a:t", NS)))
    return out


def sheet_rows(z: zipfile.ZipFile) -> dict[int, dict[str, str]]:
    strings = shared_strings(z)
    root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    rows: dict[int, dict[str, str]] = {}
    for c in root.findall(".//a:c", NS):
        ref = c.attrib.get("r")
        if not ref:
            continue
        m = re.match(r"([A-Z]+)(\d+)", ref)
        if not m:
            continue
        col, row = m.group(1), int(m.group(2))
        t = c.attrib.get("t")
        v = c.find("a:v", NS)
        if v is None:
            continue
        raw = v.text or ""
        val = strings[int(raw)] if t == "s" else raw
        rows.setdefault(row, {})[col] = val
    return rows


def importar_taxas(legs_by_key: dict[str, dict]) -> list[dict]:
    taxas: list[dict] = []
    for path in sorted(AVIOES.glob("MC_RA_*.xlsx")):
        with zipfile.ZipFile(path) as z:
            rows = sheet_rows(z)
        for r, cols in rows.items():
            if r < 6:
                continue
            if cols.get("H") not in ("PSJSA", "PS-JSA"):
                continue
            try:
                total = float(cols.get("Z", "0") or 0)
            except ValueError:
                continue
            if total <= 0:
                continue
            pouso = cols.get("Q", "")
            data = pouso.split(" ")[0]
            if not re.match(r"\d{2}/\d{2}/\d{4}", data):
                continue
            d, m, y = data.split("/")
            date_iso = f"{y}-{m}-{d}"
            month = f"{y}-{m}"
            op = cols.get("D", "")
            origem = cols.get("J", "")
            destino = cols.get("K", "")
            doc = cols.get("AA", "")
            # Casa com trecho do mesmo dia (destino/origem ICAO).
            candidatos = [
                leg
                for leg in legs_by_key.values()
                if leg["date"] == date_iso
                and (
                    leg["toIcao"] == op
                    or leg["fromIcao"] == op
                    or leg["fromIcao"] == origem
                    or leg["toIcao"] == destino
                )
            ]
            leg = None
            if candidatos:
                candidatos.sort(
                    key=lambda item: (
                        0 if item["toIcao"] == op else 1,
                        0 if item["fromIcao"] == origem and item["toIcao"] == destino else 1,
                        item["id"],
                    )
                )
                leg = candidatos[0]

            item = {
                "id": f"taxa-{cols.get('A')}",
                "aircraftId": "psjsa",
                "manual": True,
                "month": month,
                "date": date_iso,
                "category": "taxas",
                "description": f"Tarifa de pouso {op} · {origem}→{destino} · doc {doc}",
                "vendor": "Tarifa aeroportuária",
                "amount": round(total, 2),
                "allocation": "solicitante" if leg else "participacao",
                "posting": "realizado",
            }
            if leg:
                item["partnerId"] = leg["requestedBy"]
                item["itineraryId"] = leg["itineraryId"]
                item["legId"] = leg["id"]
            taxas.append(item)
    return taxas


def main() -> None:
    meta, owners = ler_pdfs()
    aeros: dict[str, str] = {}
    itineraries: list[dict] = []
    legs_index: dict[str, dict] = {}

    for lid, info in sorted(meta.items(), key=lambda kv: (kv[1]["date"], int(kv[0]))):
        partners = owners.get(lid, ["jadyel"])
        requested = escolher_solicitante(partners)
        commander = requested
        others = [p for p in partners if p != commander]
        copilot = others[0] if others else None
        hours = info["blockHours"]
        depart = "08:00"
        arrive = chegar(depart, hours)
        itinerary_id = f"voo-{info['date']}-{lid}"
        leg_id = f"etapa-{lid}"
        aeros[info["fromIcao"]] = info["fromCity"]
        aeros[info["toIcao"]] = info["toCity"]

        leg = {
            "id": leg_id,
            "date": info["date"],
            "depart": depart,
            "arrive": arrive,
            "fromIcao": info["fromIcao"],
            "toIcao": info["toIcao"],
            "fromCity": info["fromCity"],
            "toCity": info["toCity"],
            "blockHours": hours,
            "fuel": 0,
            "fees": 0,
            "handling": 0,
            "catering": 0,
            "commanderId": commander,
            "posting": "realizado",
            "requestedBy": requested,
            "itineraryId": itinerary_id,
        }
        if copilot:
            leg["copilotId"] = copilot

        # Traslado Goiânia → base (compra da aeronave): rateio entre todos.
        traslado = lid in {"1", "2", "5"}
        item = {
            "id": itinerary_id,
            "aircraftId": "psjsa",
            "title": f"{info['fromCity']} → {info['toCity']}",
            "purpose": "negocios",
            "requestedBy": requested,
            "passengers": [],
            "status": "concluido",
            "note": (
                "Traslado da aeronave até a base (compra). Despesas em participação entre os sócios."
                if traslado
                else "Importado do relatório de etapas."
            ),
            "legs": [
                {
                    k: v
                    for k, v in leg.items()
                    if k not in ("requestedBy", "itineraryId")
                }
            ],
        }
        if traslado:
            item["allocation"] = "participacao"
        itineraries.append(item)
        legs_index[leg_id] = leg

    taxas = importar_taxas(legs_index)
    total_hours = round(sum(item["blockHours"] for item in meta.values()), 1)

    pair: dict[tuple[str, str], list[float]] = defaultdict(list)
    for info in meta.values():
        pair[(info["fromIcao"], info["toIcao"])].append(info["blockHours"])
    rotas = []
    for (a, b), hs in sorted(pair.items()):
        rotas.append(
            {
                "id": f"{a}-{b}".lower(),
                "nome": f"{aeros[a]} → {aeros[b]}",
                "fromIcao": a,
                "toIcao": b,
                "fromCity": aeros[a],
                "toCity": aeros[b],
                "blockHours": round(sum(hs) / len(hs), 2),
                "note": f"{len(hs)} etapa(s) nos relatórios",
            }
        )

    partners = [
        {
            "id": "jadyel",
            "name": "Jadyel Alencar",
            "shortName": "Jadyel",
            "company": "JSA Indústria de Alimentos Ltda",
            "role": "Sócio",
            "phone": "",
        },
        {
            "id": "humberto",
            "name": "Humberto Júnior",
            "shortName": "Humberto",
            "company": "JSA Indústria de Alimentos Ltda",
            "role": "Sócio",
            "phone": "",
        },
        {
            "id": "ruan",
            "name": "Ruan Prado",
            "shortName": "Ruan",
            "company": "JSA Indústria de Alimentos Ltda",
            "role": "Sócio",
            "phone": "",
        },
    ]

    crew = [
        {
            "id": pid,
            "name": nome,
            "role": "comandante",
            "base": "Teresina",
            "aircraftIds": ["psjsa"],
            "documentLabel": "CMA / habilitação",
            "documentExpiry": "2027-12-31",
            "medicalLabel": "CMA",
            "medicalExpiry": "2027-06-30",
            "monthlyCost": 0,
            "status": "ativo",
            "nextDuty": "Conforme escala",
        }
        for _, pid, nome in PDFS
    ]

    payload = {
        "partners": partners,
        "aircraft": [
            {
                "id": "psjsa",
                "registration": "PS-JSA",
                "manufacturer": "Beechcraft",
                "model": "King Air C90",
                "category": "turbohelice",
                "year": 0,
                "seats": 8,
                "serial": "",
                "propulsion": "Turboélice bimotor",
                "range": "",
                "baseIcao": "SBTE",
                "baseName": "Teresina",
                "hangarId": "hangar-sbte",
                "totalHours": total_hours,
                "cycles": len(meta),
                "fuelBurnGph": 74,
                "status": "disponivel",
                "ownership": [
                    {"partnerId": "jadyel", "share": 0.3333},
                    {"partnerId": "humberto", "share": 0.3333},
                    {"partnerId": "ruan", "share": 0.3334},
                ],
            }
        ],
        "crew": crew,
        "hangars": [
            {
                "id": "hangar-sbte",
                "name": "Base Teresina",
                "airport": "Teresina",
                "icao": "SBTE",
                "slot": "TLT / CET",
                "aircraftId": "psjsa",
                "contract": "Operação própria",
                "contractUntil": "2027-12-31",
                "monthlyFee": 0,
                "vendor": "JSA",
                "services": ["Pernoite", "Abastecimento"],
                "manager": "Operações",
                "status": "regular",
                "note": "Base operacional recorrente.",
            }
        ],
        "seguros": [],
        "itineraries": itineraries,
        "maintenance": [],
        "extras": taxas,
        "aportes": [],
        "rotas": rotas,
        "aerodromos": aeros,
        "meta": {
            "fonte": "Relatórios de etapas de voo (PDF)",
            "legs": len(meta),
            "itineraries": len(itineraries),
            "taxas": len(taxas),
            "taxasTotal": round(sum(t["amount"] for t in taxas), 2),
            "hours": total_hours,
            "porSolicitante": {
                pid: sum(1 for owners in owners.values() if escolher_solicitante(owners) == pid)
                for _, pid, _ in PDFS
            },
        },
    }

    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload["meta"], ensure_ascii=False, indent=2))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
