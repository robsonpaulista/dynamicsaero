"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BotaoNovo, LinkEditar } from "@/components/formularios/campos";
import { PageStack } from "@/components/ui/tse";
import { listarUsuarios, excluirUsuario, type ListaUsuarios } from "@/services/usuarios";
import { PAPEL_USUARIO } from "@/types/usuario";

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

  useEffect(() => {
    void listarUsuarios().then((resultado) => {
      setLista(resultado);
      setCarregando(false);
    });
  }, []);

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
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight">Acessos do cockpit</h2>
            <p className="mt-1 text-[13px] text-tse-muted">
              Quem entra na operação, com nome, e-mail e o que pode fazer.
            </p>
          </div>
          {lista.podeControlar ? <BotaoNovo href="/usuarios/novo">Novo acesso</BotaoNovo> : null}
        </div>

        {lista.erro ? (
          <p className="mt-4 text-[13px] font-semibold text-[#EF4444]" role="alert">
            {lista.erro}
          </p>
        ) : null}

        {carregando ? (
          <p className="mt-6 text-[13px] text-tse-muted">Carregando os acessos…</p>
        ) : (
          <ul className="mt-5 divide-y divide-tse-line">
            {lista.usuarios.map((usuario) => {
              const proprio = usuario.id === lista.membroId;
              return (
                <li key={usuario.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-tse-yellow text-[12px] font-bold text-white">
                    {usuario.nome.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold">
                      {usuario.nome}
                      {proprio ? <span className="ml-2 text-[12px] font-semibold text-tse-muted">você</span> : null}
                    </span>
                    <span className="block truncate text-[13px] text-tse-muted">{usuario.email}</span>
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
        )}

        {!carregando && lista.usuarios.length === 0 && !lista.erro ? (
          <p className="mt-4 text-[13px] text-tse-muted">Nenhum acesso cadastrado.</p>
        ) : null}

        {!lista.podeControlar && !carregando ? (
          <p className="mt-4 text-[12px] text-tse-muted">Só o controle da operação inclui ou altera acessos.</p>
        ) : null}
      </section>
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
