"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FieldLabel } from "@/components/ui/tse";
import {
  cidadeDoIcao,
  mapaAerodromos,
  normalizarAerodromo,
  type Aerodromo,
} from "@/data/aerodromos";
import { useDados } from "@/hooks/use-dados";
import { salvarAerodromo } from "@/services/acoes";
import { buscarAerodromosOperacao } from "@/services/operacao";

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
  const editando = useRef<boolean>(false);
  const dados = useDados();
  const [texto, setTexto] = useState<string>(() => rotulo(icao, cidade, dados.aerodromos));
  const [aberto, setAberto] = useState<boolean>(false);
  const [indice, setIndice] = useState<number>(0);
  const [cadastrando, setCadastrando] = useState<boolean>(false);
  const [novaSigla, setNovaSigla] = useState<string>("");
  const [novaCidade, setNovaCidade] = useState<string>("");
  const [erroCadastro, setErroCadastro] = useState<string>("");

  const sugestoes = buscarAerodromosOperacao(texto, 10);
  const conhecidos = new Set(Object.keys(mapaAerodromos(dados.aerodromos)));

  useEffect(() => {
    if (editando.current) return;
    setTexto(rotulo(icao, cidade, dados.aerodromos));
  }, [icao, cidade, dados.aerodromos]);

  useEffect(() => {
    function fora(event: MouseEvent) {
      if (!caixa.current?.contains(event.target as Node)) {
        editando.current = false;
        setAberto(false);
        setCadastrando(false);
        setErroCadastro("");
        setTexto(rotulo(icao, cidade, dados.aerodromos));
      }
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [icao, cidade, dados.aerodromos]);

  function escolher(item: Aerodromo) {
    editando.current = false;
    onChange(item.icao, item.cidade);
    setTexto(rotulo(item.icao, item.cidade, dados.aerodromos));
    setAberto(false);
    setCadastrando(false);
  }

  function aplicarTexto(valor: string) {
    editando.current = true;
    setTexto(valor);
    setAberto(true);
    setIndice(0);
    setCadastrando(false);
    setErroCadastro("");
    const bruto = valor.trim();
    if (!bruto) {
      onChange("", "");
      return;
    }
    const talvezIcao = bruto.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (talvezIcao.length === 4 && !/\s|·/.test(bruto)) {
      const nome = cidadeDoIcao(talvezIcao, "", dados.aerodromos);
      if (nome) {
        onChange(talvezIcao, nome);
        return;
      }
    }
    if (icao || cidade) onChange("", "");
  }

  function abrirCadastro() {
    const bruto = texto.trim();
    const talvezIcao = bruto.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const pareceSigla = talvezIcao.length >= 3 && talvezIcao.length <= 4 && !/\s|·/.test(bruto);
    setNovaSigla(pareceSigla ? talvezIcao : "");
    setNovaCidade(pareceSigla ? "" : bruto.includes("·") ? "" : bruto);
    setErroCadastro("");
    setCadastrando(true);
    setAberto(true);
  }

  function confirmarCadastro() {
    const normalizado = normalizarAerodromo(novaSigla, novaCidade);
    if (!normalizado) {
      setErroCadastro("Informe a sigla (3–4 caracteres) e a cidade.");
      return;
    }
    const erro = salvarAerodromo(normalizado);
    if (erro) {
      setErroCadastro(erro);
      return;
    }
    escolher(normalizado);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (cadastrando) return;
    if (!aberto) return;
    const total = sugestoes.length + 1;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndice((atual) => Math.min(atual + 1, total - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndice((atual) => Math.max(atual - 1, 0));
    } else if (event.key === "Enter") {
      if (indice < sugestoes.length) {
        const item = sugestoes[indice];
        if (!item) return;
        event.preventDefault();
        escolher(item);
      } else {
        event.preventDefault();
        abrirCadastro();
      }
    } else if (event.key === "Escape") {
      setAberto(false);
      setCadastrando(false);
    }
  }

  const mostrarLista = aberto && !cadastrando;
  const destaqueCadastro = indice === sugestoes.length;

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
          onFocus={() => {
            editando.current = true;
            setAberto(true);
          }}
          onChange={(event) => aplicarTexto(event.target.value)}
          onKeyDown={onKeyDown}
          className="h-9 w-full rounded-md border border-tse-border bg-white px-2.5 text-[13px] outline-none focus:border-tse-yellow"
        />
      </label>
      {mostrarLista ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-tse-border bg-white py-1 shadow-lg"
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
          <li>
            <button
              type="button"
              role="option"
              aria-selected={destaqueCadastro}
              className={`flex w-full items-center justify-between gap-3 border-t border-tse-border px-3 py-2 text-left text-[13px] ${
                destaqueCadastro ? "bg-tse-bg font-semibold" : "hover:bg-tse-bg"
              }`}
              onMouseEnter={() => setIndice(sugestoes.length)}
              onClick={abrirCadastro}
            >
              <span className="font-semibold text-tse-text">Cadastrar aeródromo</span>
              <span className="text-[11px] text-tse-muted">sigla + cidade</span>
            </button>
          </li>
        </ul>
      ) : null}
      {aberto && cadastrando ? (
        <div
          id={listId}
          className="absolute z-20 mt-1 w-full space-y-2 rounded-xl border border-tse-border bg-white p-3 shadow-lg"
        >
          <p className="text-[12px] font-semibold text-tse-text">Novo aeródromo</p>
          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <label>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-tse-muted">
                Sigla
              </span>
              <input
                value={novaSigla}
                onChange={(event) =>
                  setNovaSigla(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    confirmarCadastro();
                  }
                }}
                placeholder="SBxx"
                autoFocus
                className="h-9 w-full rounded-md border border-tse-border bg-white px-2.5 text-[13px] font-bold tracking-wide outline-none focus:border-tse-yellow"
              />
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-tse-muted">
                Cidade
              </span>
              <input
                value={novaCidade}
                onChange={(event) => setNovaCidade(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    confirmarCadastro();
                  }
                }}
                placeholder="Nome da cidade"
                className="h-9 w-full rounded-md border border-tse-border bg-white px-2.5 text-[13px] outline-none focus:border-tse-yellow"
              />
            </label>
          </div>
          {erroCadastro ? <p className="text-[11px] text-red-700">{erroCadastro}</p> : null}
          {novaSigla && conhecidos.has(novaSigla) ? (
            <p className="text-[11px] text-amber-800">
              Já existe {novaSigla} — salvar atualiza a cidade na base da operação.
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-md px-2.5 py-1.5 text-[12px] text-tse-muted hover:bg-tse-bg"
              onClick={() => {
                setCadastrando(false);
                setErroCadastro("");
              }}
            >
              Voltar
            </button>
            <button
              type="button"
              className="rounded-md bg-tse-text px-3 py-1.5 text-[12px] font-semibold text-white"
              onClick={confirmarCadastro}
            >
              Salvar e usar
            </button>
          </div>
        </div>
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

function rotulo(icao: string, cidade: string, extras: Aerodromo[]): string {
  const codigo = icao.trim().toUpperCase();
  const nome = cidade.trim() || cidadeDoIcao(codigo, "", extras);
  if (codigo && nome) return `${codigo} · ${nome}`;
  return codigo || nome;
}
