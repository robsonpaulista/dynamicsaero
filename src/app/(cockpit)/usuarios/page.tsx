import type { Metadata } from "next";
import { UsuariosView } from "@/components/usuarios/usuarios-view";

export const metadata: Metadata = { title: "Usuários" };

export default function UsuariosPage() {
  return <UsuariosView />;
}
