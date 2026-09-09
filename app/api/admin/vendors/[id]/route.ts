import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireRole } from "@/middleware/auth/requireRole";
import { getVendorById, updateVendorApprovalStatus } from "@/services/vendors/vendor.service";
import { HttpError } from "@/utils/api/httpError";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireRole(["admin"]);
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) throw new HttpError(400, "Invalid vendor id.", "INVALID_ID");
    const vendor = await getVendorById(id);
    if (!vendor) throw new HttpError(404, "Vendor not found.", "NOT_FOUND");
    return NextResponse.json({ success: true, data: vendor });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ success: false, error: { message: error.message, code: error.code } }, { status: error.statusCode });
    return NextResponse.json({ success: false, error: { message: "Unable to load vendor." } }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireRole(["admin"]);
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id))
      throw new HttpError(400, "Invalid vendor id.", "INVALID_ID");

    const body = await request.json();
    const { approvalStatus } = body;
    if (
      !approvalStatus ||
      (approvalStatus !== "approved" && approvalStatus !== "rejected")
    ) {
      throw new HttpError(
        400,
        "approvalStatus must be 'approved' or 'rejected'.",
        "VALIDATION_ERROR",
      );
    }

    const vendor = await updateVendorApprovalStatus(id, approvalStatus);
    return NextResponse.json({ success: true, data: vendor });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { success: false, error: { message: error.message, code: error.code } },
        { status: error.statusCode },
      );
    }
    console.error("Admin approve vendor failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "Unable to update vendor status." } },
      { status: 500 },
    );
  }
}
