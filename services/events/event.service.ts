import { PipelineStage, Types } from "mongoose";
import Event, { EventDocument } from "@/models/Event";
import { EventInput, EventStatus } from "@/utils/events/validation";
import { recordActivity } from "@/services/profiles/profile.service";
import Ticket from "@/models/Ticket";
import { HttpError } from "@/utils/api/httpError";
import { createNotification } from "@/services/notifications/notification.service";
import User from "@/models/User";

export type EventListFilters = {
	page: number;
	pageSize: number;
	search?: string;
	category?: string;
	organizer?: Types.ObjectId;
	featured?: boolean;
	status?: EventStatus;
	approvalStatus?: "pending" | "approved" | "rejected";
	includeUnapproved?: boolean;
	dateFrom?: Date;
	dateTo?: Date;
	tags?: string[];
	location?: string;
	priceMin?: number;
	priceMax?: number;
	sort?: "newest" | "oldest" | "trending" | "popular" | "rating" | "priceAsc" | "priceDesc";
	rating?: number;
	availability?: "available" | "soldOut";
	free?: boolean;
	online?: boolean;
	latitude?: number;
	longitude?: number;
	distanceKm?: number;
	timeFrom?: string;
	timeTo?: string;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ticketAvailabilityLookup: PipelineStage[] = [
	{
		$lookup: {
			from: "tickets",
			let: { eventId: "$_id" },
			pipeline: [
				{ $match: { $expr: { $and: [{ $eq: ["$event", "$$eventId"] }, { $eq: ["$ticketStatus", "active"] }] } } },
				{ $group: { _id: "$ticketType", sold: { $sum: 1 } } },
			],
			as: "ticketSales",
		},
	},
	{ $addFields: { ticketsSold: { $sum: "$ticketSales.sold" } } },
	{
		$addFields: {
			ticketTypes: {
				$map: {
					input: "$ticketTypes", as: "type",
					in: {
						$let: {
							vars: { sales: { $filter: { input: "$ticketSales", as: "sale", cond: { $eq: ["$$sale._id", "$$type.name"] } } } },
							in: { $mergeObjects: ["$$type", { sold: { $ifNull: [{ $arrayElemAt: ["$$sales.sold", 0] }, 0] }, remaining: { $max: [0, { $subtract: ["$$type.quantity", { $ifNull: [{ $arrayElemAt: ["$$sales.sold", 0] }, 0] }] }] } }] },
						},
					},
				},
			},
		},
	},
];

const organizerLookup: PipelineStage[] = [
	{
		$lookup: {
			from: "users",
			localField: "organizer",
			foreignField: "_id",
			as: "organizerDetails",
		},
	},
	{ $unwind: { path: "$organizerDetails", preserveNullAndEmptyArrays: true } },
	{
		$project: {
			ticketsSold: 1,
			title: 1,
			description: 1,
			venue: 1,
			latitude: 1,
			longitude: 1,
			category: 1,
			images: 1,
			startDate: 1,
			endDate: 1,
			ticketTypes: 1,
			capacity: 1,
			status: 1,
			featured: 1,
			tags: 1,
			allowVendorStalls: 1,
			stallOpeningDate: 1,
			stallApplicationDeadline: 1,
			stallCapacity: 1,
			stallCategories: 1,
			createdAt: 1,
			updatedAt: 1,
			organizer: {
				_id: "$organizerDetails._id",
				name: "$organizerDetails.name",
				profileImage: "$organizerDetails.profileImage",
			},
		},
	},
];

export const listEvents = async (filters: EventListFilters) => {
	const match: Record<string, unknown> = {};
	if (!filters.includeUnapproved) match.approvalStatus = "approved";
	if (!filters.includeUnapproved && !filters.status) match.status = { $nin: ["cancelled", "completed"] };
	if (filters.approvalStatus) match.approvalStatus = filters.approvalStatus;
	if (filters.category) match.category = filters.category;
	if (filters.tags?.length) match.tags = { $in: filters.tags };
	if (filters.location) match.venue = new RegExp(escapeRegex(filters.location), "i");
	if (filters.organizer) match.organizer = filters.organizer;
	if (filters.featured !== undefined) match.featured = filters.featured;
	if (filters.status) match.status = filters.status;
	if (filters.search) {
		const pattern = new RegExp(escapeRegex(filters.search), "i");
		match.$or = [{ title: pattern }, { description: pattern }, { venue: pattern }, { tags: pattern }];
	}
	if (filters.dateFrom || filters.dateTo) {
		const startDate: { $gte?: Date; $lte?: Date } = {};
		if (filters.dateFrom) startDate.$gte = filters.dateFrom;
		if (filters.dateTo) startDate.$lte = filters.dateTo;
		match.startDate = startDate;
	}
	if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
		match.ticketTypes = { $elemMatch: { ...(filters.priceMin !== undefined ? { price: { $gte: filters.priceMin } } : {}), ...(filters.priceMax !== undefined ? { price: { $lte: filters.priceMax } } : {}) } };
	}
	if (filters.free !== undefined) match.ticketTypes = { $elemMatch: { price: filters.free ? 0 : { $gt: 0 } } };
	if (filters.online !== undefined) match.isOnline = filters.online;
	const timeFilter: Record<string, unknown> = {};
	if (filters.timeFrom) timeFilter.$gte = filters.timeFrom;
	if (filters.timeTo) timeFilter.$lte = filters.timeTo;

	const skip = (filters.page - 1) * filters.pageSize;
	const sort: Record<string, 1 | -1> = filters.sort === "newest" ? { createdAt: -1, _id: -1 } : filters.sort === "oldest" ? { createdAt: 1, _id: 1 } : filters.sort === "priceAsc" ? { minPrice: 1, _id: 1 } : filters.sort === "priceDesc" ? { minPrice: -1, _id: 1 } : filters.sort === "rating" ? { averageRating: -1, reviewCount: -1 } : filters.sort === "popular" || filters.sort === "trending" ? { ticketsSold: -1, createdAt: -1 } : { featured: -1, startDate: 1, _id: 1 };
	const distanceStages: PipelineStage[] = filters.latitude !== undefined && filters.longitude !== undefined ? [{ $addFields: { distanceKm: { $sqrt: { $add: [{ $pow: [{ $subtract: ["$latitude", filters.latitude] }, 2] }, { $pow: [{ $subtract: ["$longitude", filters.longitude] }, 2] }] } } } }] : [];
	const timeStages: PipelineStage[] = Object.keys(timeFilter).length ? [{ $match: { $expr: { $let: { vars: { eventTime: { $dateToString: { format: "%H:%M", date: "$startDate", timezone: "UTC" } } }, in: { $and: [filters.timeFrom ? { $gte: ["$$eventTime", filters.timeFrom] } : true, filters.timeTo ? { $lte: ["$$eventTime", filters.timeTo] } : true] } } } } }] : [];
	const [result] = await Event.aggregate([
		{ $match: match },
		...ticketAvailabilityLookup,
		{ $lookup: { from: "reviews", localField: "_id", foreignField: "event", as: "reviews" } },
		{ $addFields: { averageRating: { $ifNull: [{ $avg: "$reviews.rating" }, 0] }, reviewCount: { $size: "$reviews" }, minPrice: { $min: "$ticketTypes.price" } } },
		...distanceStages,
		...(filters.distanceKm !== undefined && filters.latitude !== undefined && filters.longitude !== undefined ? [{ $match: { distanceKm: { $lte: filters.distanceKm } } }] : []),
		...timeStages,
		...(filters.rating !== undefined ? [{ $match: { averageRating: { $gte: filters.rating } } }] : []),
		...(filters.availability === "available" ? [{ $match: { $expr: { $lt: ["$ticketsSold", "$capacity"] } } }] : filters.availability === "soldOut" ? [{ $match: { $expr: { $gte: ["$ticketsSold", "$capacity"] } } }] : []),
		...organizerLookup,
		{
			$facet: {
				items: [{ $sort: sort }, { $skip: skip }, { $limit: filters.pageSize }],
				metadata: [{ $count: "total" }],
			},
		},
	]).exec();

	return {
		items: result?.items ?? [],
		total: result?.metadata[0]?.total ?? 0,
	};
};

export const getEventById = async (id: Types.ObjectId, includeUnapproved = false) => {
	const [event] = await Event.aggregate([
		{ $match: includeUnapproved ? { _id: id } : { _id: id, approvalStatus: "approved" } },
		...ticketAvailabilityLookup,
		...organizerLookup,
	]).exec();
	return event ?? null;
};

export const createEvent = async (input: EventInput, organizer: Types.ObjectId) => {
	const event = await Event.create({ ...input, organizer, status: "draft", approvalStatus: "pending" });
	await recordActivity(organizer, "created_event", "Created an event", { subject: event._id, subjectModel: "Event", link: `/event-details/${event._id}` });
	const admins = await User.find({ role: "admin", status: "active" }).select("_id").lean().exec();
	await Promise.all(admins.map((admin) => createNotification(admin._id, "admin_update", "New event awaiting approval", `New event '${event.title}' requires approval.`, "/admin/approvals")));
	return event;
};

export const updateEventApprovalStatus = async (event: EventDocument, approvalStatus: "approved" | "rejected") => {
	event.approvalStatus = approvalStatus;
	if (approvalStatus === "approved" && event.status === "draft") event.status = "published";
	await event.save();
	const label = approvalStatus === "approved" ? "approved" : "rejected";
	createNotification(event.organizer, "event_approval", `Event ${label}`, `Your event '${event.title}' has been ${label} by an administrator.`, "/organizerdashboard").catch(console.error);
	if (approvalStatus === "approved" && event.allowVendorStalls) {
		const { notifyVendorsOfStallOpening } = await import("@/services/vendors/vendor.service");
		notifyVendorsOfStallOpening(event).catch(console.error);
	}
	return event;
};

export const findEventForManagement = (id: Types.ObjectId): Promise<EventDocument | null> => Event.findById(id).exec();

export const updateEvent = async (event: EventDocument, input: Partial<EventInput>) => {
	if (input.ticketTypes || input.capacity !== undefined) {
		const sold = await Ticket.aggregate<{ _id: string; count: number }>([
			{ $match: { event: event._id, ticketStatus: "active" } },
			{ $group: { _id: "$ticketType", count: { $sum: 1 } } },
		]).exec();
		const soldByType = new Map(sold.map((item) => [item._id, item.count]));
		const ticketTypes = input.ticketTypes ?? event.ticketTypes;
		for (const ticketType of ticketTypes) {
			if (ticketType.quantity < (soldByType.get(ticketType.name) ?? 0)) {
				throw new HttpError(409, `Ticket quantity for ${ticketType.name} cannot be lower than tickets already sold.`, "TICKET_QUANTITY_BELOW_SOLD");
			}
		}
		const soldTotal = sold.reduce((total, item) => total + item.count, 0);
		if ((input.capacity ?? event.capacity) < soldTotal) throw new HttpError(409, "Event capacity cannot be lower than tickets already sold.", "CAPACITY_BELOW_SOLD");
	}
	const startDate = input.startDate ?? event.startDate;
	const endDate = input.endDate ?? event.endDate;
	if (endDate <= startDate) throw new HttpError(400, "endDate must be after startDate.", "VALIDATION_ERROR");
	event.set(input);
	const updated = await event.save();
	if (Object.keys(input).length > 0) {
		notifyTicketHolders(updated, "event_update", "Event updated", `The event '${updated.title}' has been updated by the organizer.`).catch(console.error);
	}
	return updated;
};

export const deleteEvent = (event: EventDocument) => event.deleteOne();

export const duplicateEvent = async (event: EventDocument, organizer: Types.ObjectId) => {
	const source = event.toObject() as EventDocument & { createdAt?: Date; updatedAt?: Date };
	const eventData = { ...source };
	delete (eventData as Record<string, unknown>)._id;
	delete (eventData as Record<string, unknown>).createdAt;
	delete (eventData as Record<string, unknown>).updatedAt;
	return Event.create({
		...eventData,
		organizer,
		title: `${eventData.title} Copy`,
		status: "draft",
		featured: false,
	});
};

export const updateEventStatus = async (event: EventDocument, status: "draft" | "published" | "cancelled" | "completed") => {
	event.status = status;
	const updated = await event.save();
	if (status === "cancelled") {
		notifyTicketHolders(updated, "event_cancelled", "Event cancelled", `The event '${updated.title}' has been cancelled.`).catch(console.error);
	}
	return updated;
};

const notifyTicketHolders = async (event: EventDocument, type: "event_update" | "event_cancelled", title: string, message: string) => {
	const ticketHolders = await Ticket.distinct("user", { event: event._id, ticketStatus: "active", paymentStatus: "paid" }).exec();
	await Promise.all(ticketHolders.map((userId) => createNotification(userId, type, title, message, `/event-details/${event._id}`)));
};

export const getTrendingEvents = async (limit = 6) => {
	return Event.aggregate([
		{ $match: { status: "published", approvalStatus: "approved", startDate: { $gte: new Date() } } },
		{
			$lookup: {
				from: "tickets",
				localField: "_id",
				foreignField: "event",
				as: "bookedTickets",
			},
		},
		{
			$addFields: {
				ticketCount: { $size: "$bookedTickets" },
			},
		},
		{ $sort: { ticketCount: -1, featured: -1, startDate: 1 } },
		{ $limit: limit },
		...organizerLookup,
	]).exec();
};

export const getNearbyEvents = async (latitude: number, longitude: number, maxDistanceKm = 50, limit = 10) => {
	// Radius of Earth in kilometers = 6371
	const latDelta = maxDistanceKm / 111.12;
	const lngDelta = maxDistanceKm / (111.12 * Math.cos((latitude * Math.PI) / 180));

	return Event.aggregate([
		{
			$match: {
				status: "published",
				approvalStatus: "approved",
				startDate: { $gte: new Date() },
				latitude: { $gte: latitude - latDelta, $lte: latitude + latDelta },
				longitude: { $gte: longitude - lngDelta, $lte: longitude + lngDelta },
			},
		},
		{ $sort: { startDate: 1 } },
		{ $limit: limit },
		...organizerLookup,
	]).exec();
};
