"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FieldLabel } from "@/components/ui/tse";
import { buscarAerodromos, cidadeDoIcao, type Aerodromo } from "@/data/aerodromos";

type Props = {
  label: string;
  icao: string;
  cidade: string;
  onChange: (icao: string, cidade: string) => void;
  required?: boolean;
  placeholder?: string;
};

export function CampoAerodromo({
  label,
  icao,
  cidade,
  onChange,
  required,
  placeholder = "ICAO ou cidade — ex.: SBGR ou Guarulhos",
}: Props) {
  const listId = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState<string>(() => rotulo(icao, cidade));
  const [aberto, setAberto] = useState<boolean>(false);
  const [indice, setIndice] = useState<number>(0);

  const sugestoes = buscarAerodromos(texto, 10);

  useEffect(() => {
    setTexto(rotulo(icao, cidade));
  }, [icao, cidade]);

  useEffect(() => {
    function fora(event: MouseEvent) {
      if (!caixa.current?.contains(event.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  function escolher(item: Aerodromo) {
    onChange(item.icao, item.cidade);
    setTexto(rotulo(item.icao, item.cidade));
    setAberto(false);
  }

  function aplicarTexto(valor: string) {
    setTexto(valor);
    setAberto(true);
    setIndice(0);
    const bruto = valor.trim();
    if (!bruto) {
      onChange("", "");
      return;
    }
    // Digitação direta de ICAO (4 caracteres) preenche a cidade se existir na base.
    const talvezIcao = bruto.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (talvezIcao.length === 4 && !bruto.includes(" ")) {
      const nome = cidadeDoIcao(talvezIcao, cidade || talvezIcao);
      onChange(talvezIcao, nome);
      return;
    }
    // Mantém ICAO atual se o usuário só edita o rótulo livremente.
    if (icao) onChange(icao, cidade);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!aberto || sugestoes.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndice((atual) => Math.min(atual + 1, sugestoes.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndice((atual) => Math.max(atual - 1, 0));
    } else if (event.key === "Enter") {
      const item = sugestoes[indice];
      if (!item) return;
      event.preventDefault();
      escolher(item);
    } else if (event.key === "Escape") {
      setAberto(false);
    }
  }

  return (
    <div ref={caixa} className="relative">
      <label>
        <FieldLabel>{label}</FieldLabel>
        <input
          required={required}
          value={texto}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={aberto}
          aria-controls={listId}
          aria-autocomplete="list"
          onFocus={() => setAberto(true)}
          onChange={(event) => aplicarTexto(event.target.value)}
          onKeyDown={onKeyDown}
          className="h-9 w-full rounded-md border border-tse-border bg-white px-2.5 text-[13px] outline-none focus:border-tse-yellow"
        />
      </label>
      {aberto && sugestoes.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-tse-border bg-white py-1 shadow-lg"
        >
          {sugestoes.map((item, i) => {
            const ativo = i === indice;
            return (
              <li key={item.icao}>
                <button
                  type="button"
                  role="option"
                  aria-selected={ativo}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] ${
                    ativo ? "bg-tse-bg font-semibold" : "hover:bg-tse-bg"
                  }`}
                  onMouseEnter={() => setIndice(i)}
                  onClick={() => escolher(item)}
                >
                  <span className="font-bold tracking-wide">{item.icao}</span>
                  <span className="truncate text-tse-muted">{item.cidade}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {icao ? (
        <p className="mt-1 text-[11px] text-tse-muted">
          Selecionado: <span className="font-semibold text-tse-text">{icao}</span>
          {cidade ? ` · ${cidade}` : ""}
        </p>
      ) : null}
    </div>
  );
}

function rotulo(icao: string, cidade: string): string {
  const codigo = icao.trim().toUpperCase();
  const nome = cidade.trim() || cidadeDoIcao(codigo);
  if (codigo && nome) return `${codigo} · ${nome}`;
  return codigo || nome;
}
