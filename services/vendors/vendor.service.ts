import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import Vendor from "@/models/Vendor";
import Event, { EventDocument } from "@/models/Event";
import User from "@/models/User";
import { HttpError } from "@/utils/api/httpError";
import { createNotification, createNotificationOnce } from "@/services/notifications/notification.service";

export interface RegisterVendorInput {
	businessName: string;
	description: string;
	category: string;
	logo?: string;
}

export const createVendorProfile = async (ownerId: Types.ObjectId | string, input: RegisterVendorInput) => {
	await dbConnect();
	const ownerObjId = new Types.ObjectId(ownerId);

	const existing = await Vendor.findOne({ owner: ownerObjId }).exec();
	if (existing) {
		throw new HttpError(409, "Vendor profile already exists for this account.", "PROFILE_EXISTS");
	}

	const vendor = await Vendor.create({
		owner: ownerObjId,
		businessName: input.businessName,
		description: input.description,
		category: input.category,
		logo: input.logo,
		approvalStatus: "pending",
		stallBookings: [],
	});

	// Upgrade user role to vendor if attendee
	await User.findByIdAndUpdate(ownerObjId, { $set: { role: "vendor" } }).exec();

	createNotification(
		ownerObjId,
		"vendor_update",
		"Vendor Profile Submitted",
		"Your vendor registration was submitted and is pending admin approval."
	).catch(console.error);

	return vendor;
};

export const getVendorProfile = async (ownerId: Types.ObjectId | string) => {
	await dbConnect();
	return Vendor.findOne({ owner: new Types.ObjectId(ownerId) }).populate("owner", "name email phone").exec();
};

export const updateVendorProfile = async (ownerId: Types.ObjectId | string, data: Partial<RegisterVendorInput>) => {
	await dbConnect();
	return Vendor.findOneAndUpdate({ owner: new Types.ObjectId(ownerId) }, { $set: data }, { new: true, runValidators: true }).exec();
};

export const listVendors = async (page = 1, pageSize = 20, status?: string, search?: string) => {
	await dbConnect();
	const match: Record<string, unknown> = {};
	if (status) match.approvalStatus = status;
	if (search) {
		const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
		match.$or = [{ businessName: pattern }, { category: pattern }];
	}

	const skip = (page - 1) * pageSize;
	const [items, total] = await Promise.all([
		Vendor.find(match).populate("owner", "name email phone").sort({ createdAt: -1 }).skip(skip).limit(pageSize).exec(),
		Vendor.countDocuments(match),
	]);

	return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
};

export const getVendorById = async (vendorId: Types.ObjectId | string) => {
	await dbConnect();
	return Vendor.findById(vendorId)
		.populate("owner", "name email phone profileImage location")
		.populate("stallBookings.event", "title venue startDate endDate")
		.exec();
};

export const updateVendorApprovalStatus = async (vendorId: Types.ObjectId | string, approvalStatus: "approved" | "rejected") => {
	await dbConnect();
	const vendor = await Vendor.findByIdAndUpdate(vendorId, { $set: { approvalStatus } }, { new: true }).exec();
	if (!vendor) throw new HttpError(404, "Vendor profile not found.", "NOT_FOUND");

	createNotification(
		vendor.owner,
		"vendor_update",
		`Vendor Account ${approvalStatus === "approved" ? "Approved" : "Rejected"}`,
		`Your vendor account status has been updated to ${approvalStatus}.`
	).catch(console.error);

	return vendor;
};

export type StallRequestInput = { eventId: string; stallName: string; description: string; stallType: string; size: string; bookingFee: number };

const assertStallOpportunity = (event: EventDocument, now = new Date()) => {
	if (event.status !== "published" || event.approvalStatus !== "approved" || !event.allowVendorStalls || !event.stallOpeningDate || !event.stallApplicationDeadline || !event.stallCapacity) throw new HttpError(409, "No vendor stalls are currently available for this event.", "EVENT_NOT_OPEN");
	if (now < event.stallOpeningDate || now > event.stallApplicationDeadline) throw new HttpError(409, "The stall application window is closed.", "STALL_WINDOW_CLOSED");
};

export const notifyVendorsOfStallOpening = async (event: EventDocument) => {
	const vendors = await Vendor.find({ approvalStatus: "approved" }).select("owner").populate("owner", "location").lean().exec();
	const eventVenue = event.venue?.toLowerCase() ?? "";
	// Filter to nearby/eligible vendors: those whose user location appears in the event venue, or all if no matches
	const nearbyVendors = vendors.filter((vendor) => {
		const userLocation = (vendor.owner as unknown as { location?: string })?.location?.toLowerCase() ?? "";
		return userLocation && eventVenue.includes(userLocation);
	});
	const targets = nearbyVendors.length > 0 ? nearbyVendors : vendors;
	const link = `/vendor/stalls/create/step-1?eventId=${event._id}`;
	await Promise.all(targets.map((vendor) => createNotificationOnce(vendor.owner, "stall_opportunity", `Stalls open: ${event.title}`, `Vendor stalls are now available for ${event.title}. Apply before ${event.stallApplicationDeadline?.toLocaleDateString() ?? "the deadline"}.`, link)));
};

export const sendStallDeadlineReminders = async (ownerId: Types.ObjectId | string) => {
	const now = new Date();
	const deadline = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
	const events = await Event.find({ status: "published", approvalStatus: "approved", allowVendorStalls: true, stallOpeningDate: { $lte: now }, stallApplicationDeadline: { $gte: now, $lte: deadline } }).select("title stallApplicationDeadline").lean().exec();
	const vendor = await Vendor.findOne({ owner: new Types.ObjectId(ownerId), approvalStatus: "approved" }).select("stallBookings").lean().exec();
	if (!vendor) return;
	await Promise.all(events.filter((event) => !vendor.stallBookings.some((booking) => booking.event.toString() === event._id.toString() && booking.status !== "cancelled")).map((event) => createNotificationOnce(ownerId, "stall_deadline", `Stall deadline approaching: ${event.title}`, `Apply for a stall before ${event.stallApplicationDeadline?.toLocaleDateString()}.`, `/vendor/stalls/create/step-1?eventId=${event._id}`)));
};

export const listVendorStallOpportunities = async (ownerId: Types.ObjectId | string) => {
	await dbConnect();
	await sendStallDeadlineReminders(ownerId);
	const now = new Date();
	return Event.find({ status: "published", approvalStatus: "approved", allowVendorStalls: true, stallOpeningDate: { $lte: now }, stallApplicationDeadline: { $gte: now } })
		.select("title venue startDate endDate category images stallApplicationDeadline stallCapacity stallCategories")
		.sort({ stallApplicationDeadline: 1 })
		.lean().exec();
};
export const bookStall = async (ownerId: Types.ObjectId | string, input: StallRequestInput) => {
	await dbConnect();
	const { eventId, stallName, description, stallType, size, bookingFee } = input;
	const vendor = await Vendor.findOne({ owner: new Types.ObjectId(ownerId) }).exec();
	if (!vendor) throw new HttpError(404, "Vendor profile not found.", "NOT_FOUND");
	if (vendor.approvalStatus !== "approved") throw new HttpError(403, "Only approved vendors can book stalls.", "FORBIDDEN");

	const event = await Event.findById(eventId).exec();
	if (!event) throw new HttpError(404, "Event not found.", "NOT_FOUND");
	assertStallOpportunity(event);

	const duplicate = vendor.stallBookings.find((b) => b.event.toString() === eventId && b.status !== "cancelled");
	if (duplicate) throw new HttpError(409, "You already have a stall booking for this event.", "DUPLICATE_BOOKING");

	vendor.stallBookings.push({
		event: event._id,
		stallName,
		description,
		stallType,
		size,
		bookingFee,
		bookedAt: new Date(),
		status: "pending",
	});

	await vendor.save();
	const vendorOwner = await User.findById(vendor.owner).select("name").lean().exec();
	createNotification(
		event.organizer,
		"stall_application",
		"New stall application",
		`${vendorOwner?.name ?? "A vendor"} applied for a stall at ${event.title}.`,
		"/organizerdashboard",
	).catch(console.error);
	return vendor;
};

export const cancelStallBooking = async (ownerId: Types.ObjectId | string, eventId: string) => {
	await dbConnect();
	const vendor = await Vendor.findOne({ owner: new Types.ObjectId(ownerId) }).exec();
	if (!vendor) throw new HttpError(404, "Vendor profile not found.", "NOT_FOUND");

	const booking = vendor.stallBookings.find((b) => b.event.toString() === eventId && b.status !== "cancelled");
	if (!booking) throw new HttpError(404, "Active stall booking not found for this event.", "NOT_FOUND");

	booking.status = "cancelled";
	await vendor.save();
	return vendor;
};

export const getVendorDashboard = async (ownerId: Types.ObjectId | string) => {
	await dbConnect();
	const vendor = await Vendor.findOne({ owner: new Types.ObjectId(ownerId) })
		.populate({ path: "stallBookings.event", select: "title description organizer venue latitude longitude startDate endDate status images category isOnline ticketTypes capacity ticketsSold tags" })
		.populate({ path: "stallBookings.event", populate: { path: "organizer", select: "name profileImage" } })
		.exec();

	if (!vendor) throw new HttpError(404, "Vendor profile not found.", "NOT_FOUND");

	const now = new Date();
	const activeBookings = vendor.stallBookings.filter((b) => b.status === "confirmed");
	const events = activeBookings.map((booking) => booking.event as unknown as { startDate?: Date; endDate?: Date; status?: string }).filter((event) => event && typeof event === "object");
	const upcomingEvents = events.filter((event) => event.startDate && new Date(event.startDate) > now);
	const activeEvents = events.filter((event) => event.startDate && event.endDate && new Date(event.startDate) <= now && new Date(event.endDate) >= now && event.status === "published");
	const completedEvents = events.filter((event) => event.status === "completed" || (event.endDate && new Date(event.endDate) < now));

	return {
		vendor,
		summary: {
			approvalStatus: vendor.approvalStatus,
			totalBookings: vendor.stallBookings.length,
			activeBookingsCount: activeBookings.length,
			upcomingEventsCount: upcomingEvents.length,
			activeEventsCount: activeEvents.length,
			completedEventsCount: completedEvents.length,
		},
		bookings: vendor.stallBookings,
	};
};

export const getVendorAssignedEvents = async (ownerId: Types.ObjectId | string) => {
	const data = await getVendorDashboard(ownerId);
	return data.bookings.filter((booking) => booking.status === "confirmed");
};

export const getVendorAssignedEvent = async (ownerId: Types.ObjectId | string, eventId: string) => {
	if (!Types.ObjectId.isValid(eventId)) throw new HttpError(400, "Event id is invalid.", "INVALID_ID");
	const bookings = await getVendorAssignedEvents(ownerId);
	const booking = bookings.find((item) => {
		const event = item.event as unknown as { _id?: Types.ObjectId };
		return event?._id?.toString() === eventId;
	});
	if (!booking) throw new HttpError(404, "Assigned event not found.", "NOT_FOUND");
	return booking;
};

export const listStallRequests = async (page = 1, pageSize = 50, status?: "pending" | "confirmed" | "cancelled") => {
	await dbConnect();
	const vendors = await Vendor.find(status ? { "stallBookings.status": status } : {}).populate("owner", "name email").populate({ path: "stallBookings.event", select: "title approvalStatus status category" }).sort({ createdAt: -1 }).exec();
	const items = vendors.flatMap((vendor) => vendor.stallBookings.filter((booking) => !status || booking.status === status).map((booking) => ({ vendorId: vendor._id, vendor: { businessName: vendor.businessName, category: vendor.category, owner: vendor.owner }, event: booking.event, stallName: booking.stallName, description: booking.description, stallType: booking.stallType, size: booking.size, bookingFee: booking.bookingFee, status: booking.status, bookedAt: booking.bookedAt })));
	const start = (page - 1) * pageSize;
	return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize, totalPages: Math.ceil(items.length / pageSize) };
};

export const updateStallApprovalStatus = async (vendorId: string, eventId: string, status: "confirmed" | "cancelled") => {
	await dbConnect();
	if (!Types.ObjectId.isValid(vendorId) || !Types.ObjectId.isValid(eventId)) throw new HttpError(400, "Invalid stall request id.", "INVALID_ID");
	const vendor = await Vendor.findById(vendorId).exec();
	if (!vendor) throw new HttpError(404, "Vendor profile not found.", "NOT_FOUND");
	const booking = vendor.stallBookings.find((item) => item.event.toString() === eventId && item.status === "pending");
	if (!booking) throw new HttpError(404, "Pending stall request not found.", "NOT_FOUND");
	if (status === "confirmed") {
		const event = await Event.findById(eventId).exec();
		if (!event) throw new HttpError(404, "Event not found.", "NOT_FOUND");
		assertStallOpportunity(event);
		const confirmed = await Vendor.countDocuments({ stallBookings: { $elemMatch: { event: event._id, status: "confirmed" } } });
		if (confirmed >= event.stallCapacity!) throw new HttpError(409, "All available vendor stalls have been approved.", "STALL_CAPACITY_REACHED");
	}
	booking.status = status;
	await vendor.save();
	createNotification(vendor.owner, "stall_update", `Stall request ${status === "confirmed" ? "approved" : "rejected"}`, `Your stall request has been ${status === "confirmed" ? "approved" : "rejected"} by an administrator.`, "/vendor/events").catch(console.error);
	return vendor;
};
