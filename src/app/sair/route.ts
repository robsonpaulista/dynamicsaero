import { redirect } from "next/navigation";
import { sair } from "@/services/usuarios";

export async function GET() {
  await sair();
  redirect("/entrar");
}
