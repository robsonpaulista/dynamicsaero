import type { Metadata } from "next";
import { UsuarioForm } from "@/components/usuarios/usuario-form";
import { sessaoAtual } from "@/services/usuarios";

export const metadata: Metadata = { title: "Novo acesso" };

export default async function NovoUsuarioPage() {
  const sessao = await sessaoAtual();
  return <UsuarioForm id={null} podeControlar={sessao?.papel === "controlador"} />;
}
