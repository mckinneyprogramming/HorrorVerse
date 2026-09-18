import { loadCatalog } from "../../lib/catalog";

export async function GET(
  _request: Request,
  context: { params: { kind: string } | Promise<{ kind: string }> },
) {
  try {
    const params = await Promise.resolve(context.params);
    return Response.json(await loadCatalog(params.kind));
  } catch {
    return Response.json({ error: "Catalog unavailable." }, { status: 500 });
  }
}
