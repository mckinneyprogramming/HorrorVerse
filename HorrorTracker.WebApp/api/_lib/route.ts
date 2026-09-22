export function namedRoute(request: Request, names: readonly string[]): string | undefined {
  const url = new URL(request.url);
  const route = url.searchParams.get("route")?.trim().toLowerCase();
  if (route && names.includes(route)) {
    return route;
  }

  const path = url.pathname.replace(/\/+$/, "").toLowerCase();
  return names.find((name) => path.endsWith(`/${name}`));
}
