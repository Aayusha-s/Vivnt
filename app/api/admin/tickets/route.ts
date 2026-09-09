import { NextResponse } from "next/server";
import { requireRole } from "@/middleware/auth/requireRole";
import dbConnect from "@/lib/mongodb";
import Ticket from "@/models/Ticket";
import { HttpError } from "@/utils/api/httpError";

export async function GET(request: Request) {
  try {
    await requireRole(["admin"]);
    await dbConnect();
    const params = new URL(request.url).searchParams;
    const search = params.get("search")?.trim();
    const status = params.get("status")?.trim();
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 50)));
    const filter: Record<string, unknown> = {};
    if (status && ["active", "cancelled"].includes(status)) filter.ticketStatus = status;
    if (search) filter.ticketNumber = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const [items, total] = await Promise.all([
      Ticket.find(filter)
        .populate("user", "name email")
        .populate({ path: "event", select: "title venue startDate organizer", populate: { path: "organizer", select: "name" } })
        .sort({ purchaseDate: -1 })
        .skip((page - 1) * pageSize).limit(pageSize).lean().exec(),
      Ticket.countDocuments(filter),
    ]);
    return NextResponse.json({ success: true, data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ success: false, error: { message: error.message, code: error.code } }, { status: error.statusCode });
    return NextResponse.json({ success: false, error: { message: "Unable to list tickets." } }, { status: 500 });
  }
}