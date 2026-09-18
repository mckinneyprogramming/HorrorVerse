import { loadCatalog } from "../lib/catalog";

export async function GET() {
  try {
    return Response.json(await loadCatalog());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog unavailable.";
    const status = message.includes("not configured") ? 503 : 500;
    return Response.json({ error: "Catalog unavailable." }, { status });
  }
}
