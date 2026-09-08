import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/auth";
import dbConnect from "@/lib/mongodb";
import Event from "@/models/Event";
import User from "@/models/User";
import SearchHistory from "@/models/SearchHistory";
import { parseVoiceSearch } from "@/lib/voiceSearch";

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim().slice(0, 100);
  const session = await getServerSession(authOptions);

  await dbConnect();

  if (!query) {
    return NextResponse.json({
      success: true,
      data: {
        events: [],
        people: [],
        count: 0,
      },
    });
  }

  const pattern = new RegExp(escape(query), "i");
  const intent = parseVoiceSearch(query);
  const eventSearch = intent.searchTerm ? new RegExp(escape(intent.searchTerm), "i") : pattern;
  const eventFilters: Record<string, unknown> = { status: "published" };

  if (intent.freeOnly) eventFilters.ticketTypes = { $elemMatch: { price: 0 } };
  if (intent.location) eventFilters.venue = new RegExp(escape(intent.location), "i");
  if (intent.searchTerm) {
    eventFilters.$or = [
      { title: eventSearch },
      { venue: eventSearch },
      { tags: eventSearch },
      { description: eventSearch },
    ];
  }

  const now = new Date();
  if (/\b(?:today|tonight)\b/i.test(query)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    eventFilters.startDate = { $gte: now, $lt: tomorrow };
  } else if (/\b(?:this weekend)\b/i.test(query)) {
    const endOfWeekend = new Date(now);
    endOfWeekend.setDate(endOfWeekend.getDate() + (7 - endOfWeekend.getDay()));
    endOfWeekend.setHours(23, 59, 59, 999);
    eventFilters.startDate = { $gte: now, $lte: endOfWeekend };
  } else if (/\b(?:this week)\b/i.test(query)) {
    const endOfWeek = new Date(now);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);
    eventFilters.startDate = { $gte: now, $lte: endOfWeek };
  }

  const peopleFilters: Record<string, unknown> = {
    role: { $in: ["organizer", "vendor", "attendee", "ticket_checker"] },
  };
  if (intent.searchTerm) {
    peopleFilters.$or = [
      { name: eventSearch },
      { username: eventSearch },
      { bio: eventSearch },
    ];
  } else if (!intent.peopleOnly) {
    peopleFilters.$or = [
      { name: pattern },
      { username: pattern },
      { bio: pattern },
    ];
  }

  // Search events and people in parallel
  const [events, people] = await Promise.all([
    // Search events
    Event.find(intent.peopleOnly ? { _id: { $exists: false } } : eventFilters)
      .select(
        "_id title venue images tags description startDate ticketTypes organizer",
      )
      .populate("organizer", "_id name")
      .sort(intent.sort === "newest" ? { createdAt: -1 } : { ticketsSold: -1, startDate: 1 })
      .limit(20)
      .lean(),

    // Search people (Organizer, Vendor, Attendee, Ticket Checker - NOT Admin)
    User.find(peopleFilters)
      .select("_id name username profileImage role bio followers location")
      .limit(intent.peopleOnly ? 20 : 10)
      .lean(),
  ]);

  // Record search in history
  if (session?.user?.id) {
    await SearchHistory.findOneAndUpdate(
      {
        user: new Types.ObjectId(session.user.id),
        query: query,
      },
      {
        $set: { query: query },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).catch(() => {
      // Silently fail if history recording fails
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      events,
      people,
      count: events.length + people.length,
      query,
    },
  });
}
