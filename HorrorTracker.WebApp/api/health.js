/* Generated from api-src. Edit api-src and lib, then run npm run bundle-api. */


// api-src/health.ts
var runtime = "nodejs";
function GET() {
  return Response.json({
    status: "ok",
    databaseConfigured: Boolean(
      process.env.DATABASE_URL?.trim() || process.env.HorrorVerseDb?.trim()
    )
  });
}
export {
  GET,
  runtime
};
