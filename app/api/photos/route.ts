import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import { requireRole } from "@/middleware/auth/requireRole";
import Photo from "@/models/Photo";
import { recordActivity } from "@/services/profiles/profile.service";
import { HttpError } from "@/utils/api/httpError";
const roles = [
  "attendee",
  "organizer",
  "vendor",
  "ticket_checker",
  "admin",
] as const;

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function GET(request: Request) {
  try {
    const eventId = new URL(request.url).searchParams.get("eventId");
    if (!eventId || !Types.ObjectId.isValid(eventId))
      throw new HttpError(400, "A valid eventId is required.", "VALIDATION_ERROR");
    await dbConnect();
    const photos = await Photo.find({ event: eventId }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: photos });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: error instanceof HttpError ? error.message : "Unable to load photos." } },
      { status: error instanceof HttpError ? error.statusCode : 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireRole([...roles]);
    const formData = await request.formData();
    const file = formData.get("file");
    const eventId = formData.get("eventId");
    if (!(file instanceof File) || typeof eventId !== "string" || !Types.ObjectId.isValid(eventId))
      throw new HttpError(400, "A valid image and eventId are required.", "VALIDATION_ERROR");
    const extension = allowedTypes.get(file.type);
    if (!extension) throw new HttpError(400, "Only JPG, PNG, and WebP images are supported.", "VALIDATION_ERROR");
    if (file.size > 10 * 1024 * 1024) throw new HttpError(400, "Images must be 10MB or smaller.", "VALIDATION_ERROR");

    const directory = path.join(process.cwd(), "public", "uploads", "photos");
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}.${extension}`;
    await writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()));
    await dbConnect();
    const photo = await Photo.create({
      user: new Types.ObjectId(session.user.id),
      imageUrl: `/uploads/photos/${filename}`,
      event: new Types.ObjectId(eventId),
    });
    return NextResponse.json({ success: true, data: photo }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: error instanceof HttpError ? error.message : "Unable to upload photo." } },
      { status: error instanceof HttpError ? error.statusCode : 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole([...roles]);
    const body = await request.json();
    if (typeof body.imageUrl !== "string" || !body.imageUrl.trim())
      throw new HttpError(400, "imageUrl is required.", "VALIDATION_ERROR");
    const user = new Types.ObjectId(session.user.id);
    const photo = await Photo.create({
      user,
      imageUrl: body.imageUrl.trim(),
      caption:
        typeof body.caption === "string" ? body.caption.trim() : undefined,
      event: Types.ObjectId.isValid(body.eventId) ? body.eventId : undefined,
    });
    await recordActivity(user, "photo", "Uploaded a photo", {
      subject: photo._id,
      subjectModel: "Photo",
    });
    return NextResponse.json({ success: true, data: photo }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            error instanceof HttpError
              ? error.message
              : "Unable to upload photo.",
        },
      },
      { status: error instanceof HttpError ? error.statusCode : 500 },
    );
  }
}
