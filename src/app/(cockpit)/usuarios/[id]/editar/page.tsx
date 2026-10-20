import type { Metadata } from "next";
import { UsuarioForm } from "@/components/usuarios/usuario-form";
import { sessaoAtual } from "@/services/usuarios";

export const metadata: Metadata = { title: "Editar acesso" };

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessao = await sessaoAtual();
  return <UsuarioForm id={id} podeControlar={sessao?.papel === "controlador"} />;
}
