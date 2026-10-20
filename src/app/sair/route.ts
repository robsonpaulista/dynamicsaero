import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { sair } from "@/services/usuarios";

function ehPrefetch(request: Request): boolean {
  if (request.headers.get("next-router-prefetch")) return true;
  if (request.headers.get("next-router-segment-prefetch")) return true;
  if (request.headers.get("purpose") === "prefetch") return true;
  return request.headers.get("sec-fetch-dest") !== "document";
}

export async function GET(request: Request) {
  if (ehPrefetch(request)) {
    return new NextResponse(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  }
  await sair();
  redirect("/entrar");
}

export async function POST() {
  await sair();
  redirect("/entrar");
}
