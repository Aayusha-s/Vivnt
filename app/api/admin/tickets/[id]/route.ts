import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireRole } from "@/middleware/auth/requireRole";
import { getTicketById, updateTicketStatus } from "@/services/tickets/ticket.service";
import { HttpError } from "@/utils/api/httpError";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireRole(["admin"]);
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) throw new HttpError(400, "Ticket id is invalid.", "INVALID_ID");
    const ticket = await getTicketById(new Types.ObjectId(id), new Types.ObjectId(session.user.id), "admin");
    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ success: false, error: { message: error.message, code: error.code } }, { status: error.statusCode });
    return NextResponse.json({ success: false, error: { message: "Unable to load ticket." } }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireRole(["admin"]);
    const { id } = await context.params;
    const { ticketStatus } = await request.json();
    if (!Types.ObjectId.isValid(id) || !["active", "cancelled"].includes(ticketStatus)) throw new HttpError(400, "A valid ticket status is required.", "VALIDATION_ERROR");
    const ticket = await updateTicketStatus(new Types.ObjectId(id), new Types.ObjectId(session.user.id), "admin", ticketStatus);
    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ success: false, error: { message: error.message, code: error.code } }, { status: error.statusCode });
    return NextResponse.json({ success: false, error: { message: "Unable to update ticket." } }, { status: 500 });
  }
}