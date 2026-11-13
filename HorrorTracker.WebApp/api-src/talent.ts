export const runtime = "nodejs";
export const maxDuration = 30;

import {
  followTalent,
  listFollowedTalent,
  listFollowUpcoming,
  openTalent,
  titleCredits,
  unfollowTalent,
} from "../lib/talent";
import { HttpError, jsonError, requireDatabaseUrl, requireSessionUser } from "../lib/neon";
import { loadUpcomingSchedule } from "./upcoming";

export async function GET(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireSessionUser(request, connectionString);
    const url = new URL(request.url);
    const title = url.searchParams.get("title");
    if (title) {
      return Response.json(await titleCredits(connectionString, title));
    }

    const person = Number(url.searchParams.get("person"));
    if (url.searchParams.has("person")) {
      return Response.json({ person: await openTalent(connectionString, user.id, person) });
    }

    if (url.searchParams.get("upcoming") === "1") {
      const schedule = await loadUpcomingSchedule();
      return Response.json({ titles: await listFollowUpcoming(connectionString, user.id, schedule) });
    }

    return Response.json({ people: await listFollowedTalent(connectionString, user.id) });
  } catch (error) {
    return jsonError(error, { log: "Talent request failed.", fallback: "Could not load that filmography." });
  }
}

export async function POST(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireSessionUser(request, connectionString);
    const body = (await request.json().catch(() => ({}))) as { personId?: unknown };
    return Response.json({ person: await followTalent(connectionString, user.id, Number(body.personId)) });
  } catch (error) {
    return jsonError(error, { log: "Talent request failed.", fallback: "Could not follow that person." });
  }
}

export async function DELETE(request: Request) {
  try {
    const connectionString = requireDatabaseUrl();
    const user = await requireSessionUser(request, connectionString);
    const person = Number(new URL(request.url).searchParams.get("person"));
    if (!new URL(request.url).searchParams.has("person")) {
      throw new HttpError("Choose a person to open.", 400);
    }

    return Response.json({ person: await unfollowTalent(connectionString, user.id, person) });
  } catch (error) {
    return jsonError(error, { log: "Talent request failed.", fallback: "Could not unfollow that person." });
  }
}
