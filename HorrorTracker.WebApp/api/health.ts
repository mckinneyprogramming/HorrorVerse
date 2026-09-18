export const runtime = "nodejs";

export function GET() {
  return Response.json({
    status: "ok",
    databaseConfigured: Boolean(
      process.env.DATABASE_URL?.trim() || process.env.HorrorVerseDb?.trim(),
    ),
  });
}
