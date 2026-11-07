"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Shield, Users } from "lucide-react";
import { BotaoNovo, LinkEditar } from "@/components/formularios/campos";
import { PageStack } from "@/components/ui/tse";
import { listarUsuarios, excluirUsuario, type ListaUsuarios } from "@/services/usuarios";
import { PAPEL_USUARIO, type PapelUsuario } from "@/types/usuario";

export function UsuariosView() {
  const [lista, setLista] = useState<ListaUsuarios>({
    usuarios: [],
    erro: null,
    podeControlar: false,
    membroId: "",
  });
  const [carregando, setCarregando] = useState<boolean>(true);
  const [confirmarId, setConfirmarId] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");

  useEffect(() => {
    void listarUsuarios().then((resultado) => {
      setLista(resultado);
      setCarregando(false);
    });
  }, []);

  const usuarios = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return lista.usuarios.filter((usuario) => {
      if (!needle) return true;
      const blob = [usuario.nome, usuario.email, PAPEL_USUARIO[usuario.papel]]
        .join(" ")
        .toLowerCase();
      return blob.includes(needle);
    });
  }, [lista.usuarios, query]);

  const porPapel = (papel: PapelUsuario) =>
    lista.usuarios.filter((usuario) => usuario.papel === papel).length;

  async function remover(id: string) {
    setExcluindo(true);
    const falha = await excluirUsuario(id);
    if (falha) {
      setLista((atual) => ({ ...atual, erro: falha }));
      setExcluindo(false);
      setConfirmarId(null);
      return;
    }
    const resultado = await listarUsuarios();
    setLista(resultado);
    setExcluindo(false);
    setConfirmarId(null);
  }

  return (
    <PageStack>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight">Acessos</h1>
          <p className="mt-0.5 text-[13px] text-tse-muted">
            Quem entra no cockpit, com nome, e-mail e papel
          </p>
        </div>
        {lista.podeControlar ? (
          <Link
            href="/usuarios/novo"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-tse-text text-white shadow-sm md:hidden"
            aria-label="Novo acesso"
          >
            <Plus className="size-5" aria-hidden />
          </Link>
        ) : null}
      </div>

      {lista.podeControlar ? (
        <div className="hidden justify-end md:flex">
          <BotaoNovo href="/usuarios/novo">Novo acesso</BotaoNovo>
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">Resumo</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricaIcone icone={Users} label="Acessos" value={String(lista.usuarios.length)} />
          <MetricaIcone icone={Shield} label="Controle" value={String(porPapel("controlador"))} />
          <MetricaIcone icone={Users} label="Operação" value={String(porPapel("operacao"))} />
          <MetricaIcone
            icone={Users}
            label="Sócio / leitura"
            value={String(porPapel("socio") + porPapel("leitura"))}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[#EEF0F3] bg-white p-4 shadow-sm">
        <label className="relative block">
          <span className="sr-only">Buscar acessos</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tse-muted"
            aria-hidden
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, e-mail ou papel"
            className="h-11 w-full rounded-xl border border-tse-line bg-tse-bg/40 pr-3 pl-10 text-[14px] outline-none focus:border-tse-olive"
          />
        </label>
      </section>

      {lista.erro ? (
        <p className="text-[13px] font-semibold text-[#EF4444]" role="alert">
          {lista.erro}
        </p>
      ) : null}

      {carregando ? (
        <p className="rounded-2xl border border-[#EEF0F3] bg-white px-4 py-8 text-center text-[13px] text-tse-muted shadow-sm">
          Carregando os acessos…
        </p>
      ) : usuarios.length === 0 ? (
        <p className="rounded-2xl border border-[#EEF0F3] bg-white px-4 py-8 text-center text-[13px] text-tse-muted shadow-sm">
          {query.trim() ? "Nenhum acesso com essa busca." : "Nenhum acesso cadastrado."}
        </p>
      ) : (
        <>
          <p className="text-[13px] text-tse-muted">
            {usuarios.length} acesso{usuarios.length === 1 ? "" : "s"}
          </p>
          <section className="overflow-hidden rounded-2xl border border-[#EEF0F3] bg-white shadow-sm">
            <ul className="divide-y divide-[#EEEEEE]">
              {usuarios.map((usuario) => {
                const proprio = usuario.id === lista.membroId;
                return (
                  <li key={usuario.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                    <span className="flex size-9 items-center justify-center rounded-full bg-tse-text text-[12px] font-bold text-white">
                      {usuario.nome.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold">
                        {usuario.nome}
                        {proprio ? (
                          <span className="ml-2 text-[12px] font-semibold text-tse-muted">você</span>
                        ) : null}
                      </span>
                      <span className="block truncate text-[13px] text-tse-muted">
                        {usuario.email}
                      </span>
                    </span>
                    <span className="rounded-full bg-tse-soft px-2.5 py-1 text-[12px] font-bold text-tse-text">
                      {PAPEL_USUARIO[usuario.papel]}
                    </span>
                    {lista.podeControlar ? (
                      <span className="flex items-center gap-3">
                        <LinkEditar href={`/usuarios/${usuario.id}/editar`} />
                        {proprio ? null : confirmarId === usuario.id ? (
                          <>
                            <button
                              type="button"
                              disabled={excluindo}
                              onClick={() => {
                                void remover(usuario.id);
                              }}
                              className="text-[12px] font-bold text-[#EF4444]"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmarId(null)}
                              className="text-[12px] font-semibold text-tse-muted"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmarId(usuario.id)}
                            className="text-[12px] font-bold text-[#EF4444]"
                          >
                            Excluir
                          </button>
                        )}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {!lista.podeControlar && !carregando ? (
        <p className="text-[12px] text-tse-muted">
          Só o controle da operação inclui ou altera acessos.
        </p>
      ) : null}

      <p className="text-[12px] text-tse-muted">
        O rateio continua nos cotistas.{" "}
        <Link href="/pessoal" className="font-bold text-tse-olive hover:underline">
          Pessoal
        </Link>{" "}
        é o cadastro da operação, não o acesso ao sistema.
      </p>
    </PageStack>
  );
}

function MetricaIcone({
  icone: Icone,
  label,
  value,
}: {
  icone: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[11px] text-tse-muted">
        <Icone className="size-3.5 shrink-0 text-tse-olive" aria-hidden />
        {label}
      </p>
      <p className="mt-1 truncate text-[18px] font-bold tracking-tight tabular-nums sm:text-[20px]">
        {value}
      </p>
    </div>
  );
}
