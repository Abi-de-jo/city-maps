import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  if (name !== "google-like.json") return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(path.resolve(process.cwd(), "..", "styles", name), "utf8");
    return new Response(body, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
