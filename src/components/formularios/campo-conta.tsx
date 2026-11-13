"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FieldLabel } from "@/components/ui/tse";
import { buscarContasPlano } from "@/data/plano-contas";
import type { ContaPlano } from "@/types/operacao";

type Props = {
  label: string;
  contas: ContaPlano[];
  value: ContaPlano | null;
  onChange: (conta: ContaPlano | null) => void;
  required?: boolean;
};

export function CampoConta({ label, contas, value, onChange, required }: Props) {
  const listId = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState<string>(value?.nome ?? "");
  const [aberto, setAberto] = useState<boolean>(false);
  const [indice, setIndice] = useState<number>(0);
  const sugestoes = buscarContasPlano(contas, texto, 10);

  useEffect(() => {
    setTexto(value?.nome ?? "");
  }, [value]);

  useEffect(() => {
    function fora(event: MouseEvent) {
      if (!caixa.current?.contains(event.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  function escolher(item: ContaPlano) {
    onChange(item);
    setTexto(item.nome);
    setAberto(false);
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
    <div ref={caixa} className="relative sm:col-span-2">
      <label>
        <FieldLabel>{label}</FieldLabel>
        <input
          required={required}
          value={texto}
          placeholder="Buscar conta — ex.: Taxas aeroportuárias"
          autoComplete="off"
          role="combobox"
          aria-expanded={aberto}
          aria-controls={listId}
          onFocus={() => setAberto(true)}
          onChange={(event) => {
            setTexto(event.target.value);
            setAberto(true);
            setIndice(0);
            if (!event.target.value.trim()) onChange(null);
          }}
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
              <li key={item.id}>
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
                  <span>{item.nome}</span>
                  <span className="shrink-0 text-[11px] font-bold tracking-wide text-tse-muted uppercase">
                    {item.grupo === "fixa" ? "Fixa" : "Variável"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {value ? (
        <p className="mt-1 text-[11px] text-tse-muted">
          Classificação:{" "}
          <span className="font-semibold text-tse-text">
            {value.grupo === "fixa" ? "Despesa fixa" : "Despesa variável"}
          </span>
        </p>
      ) : null}
    </div>
  );
}
