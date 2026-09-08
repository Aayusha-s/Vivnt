import { randomUUID } from "crypto";
import mongoose, { Types } from "mongoose";
import QRCode from "qrcode";
import dbConnect from "@/lib/mongodb";
import Booking, { BookingDocument } from "@/models/Booking";
import Event from "@/models/Event";
import Payment from "@/models/Payment";
import Ticket from "@/models/Ticket";
import { HttpError } from "@/utils/api/httpError";
import { recordActivity } from "@/services/profiles/profile.service";
import { BookTicketInput } from "@/utils/tickets/validation";
import { createNotificationOnce } from "@/services/notifications/notification.service";

const ticketNumber = () => `VIVNT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
const logBooking = (stage: string, fields: Record<string, unknown>) => { if (process.env.NODE_ENV !== "production") console.info(`[Booking] ${stage}`, fields); };

const notifyCompletedBooking = async (bookingId: Types.ObjectId, paymentCompleted: boolean) => {
	const booking = await Booking.findById(bookingId).populate("event", "title organizer").lean().exec();
	if (!booking) return;
	const event = booking.event as unknown as { _id: Types.ObjectId; title: string; organizer: Types.ObjectId };
	const eventLink = `/event-details/${event._id}`;
	await Promise.all([
		createNotificationOnce(booking.user, "booking", "Ticket booked successfully", `Your ticket for ${event.title} has been booked successfully.`, eventLink),
		...(paymentCompleted ? [createNotificationOnce(booking.user, "payment_success", "Payment successful", `Your payment for ${event.title} was successful.`, `/tickets`)] : []),
		createNotificationOnce(event.organizer, "ticket_booking", "New ticket booking", `A new ticket booking was made for ${event.title}.`, "/organizerdashboard"),
	]);
};

export const bookingService = {
	createBooking: async (userId: Types.ObjectId | string, input: BookTicketInput) => {
		await dbConnect();
		const user = new Types.ObjectId(userId);
		logBooking("create requested", { userId: user.toString(), eventId: input.eventId.toString(), itemCount: input.items.length });
		const event = await Event.findById(input.eventId).exec();
		if (!event) throw new HttpError(404, "Event not found.", "NOT_FOUND");
		if (event.status !== "published") throw new HttpError(409, "This event is not published.", "EVENT_NOT_PUBLISHED");
		if (event.endDate <= new Date()) throw new HttpError(409, "This event has ended.", "EVENT_ENDED");
		if (event.startDate <= new Date()) throw new HttpError(409, "This event has already started.", "EVENT_STARTED");
		const types = new Map(event.ticketTypes.map((type) => [type.name, type]));
		const items = input.items.map((item) => {
			const type = types.get(item.ticketType);
			if (!type) throw new HttpError(400, `${item.ticketType} is not available for this event.`, "INVALID_TICKET_TYPE");
			return { ...item, unitPrice: type.price };
		});
		const total = items.reduce((sum, item) => sum + item.quantity, 0);
		const ticketCounts = await Ticket.aggregate([{ $match: { event: event._id, ticketStatus: "active" } }, { $group: { _id: "$ticketType", count: { $sum: 1 } } }]).exec();
		const sold = new Map(ticketCounts.map((item) => [item._id as string, item.count as number]));
		for (const item of items) if ((sold.get(item.ticketType) ?? 0) + item.quantity > types.get(item.ticketType)!.quantity) throw new HttpError(409, `${item.ticketType} is sold out.`, "TICKET_TYPE_SOLD_OUT");
		const eventSold = [...sold.values()].reduce((sum, count) => sum + count, 0);
		if (eventSold + total > event.capacity) throw new HttpError(409, "This event is sold out.", "EVENT_SOLD_OUT");
		const booking = await Booking.create({ user, event: event._id, items, totalAmount: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) });
		if (booking.totalAmount === 0) {
			return bookingService.completeFreeBooking(booking._id);
		}
		await recordActivity(user, "booking", "Booked an event", { subject: event._id, subjectModel: "Event", link: `/event-details/${event._id}` });
		logBooking("create completed", { bookingId: booking._id.toString(), eventId: event._id.toString(), totalAmount: booking.totalAmount, itemCount: booking.items.length });
		return booking;
	},
	completeFreeBooking: async (bookingId: Types.ObjectId) => {
		await dbConnect();
		const session = await mongoose.startSession();
		try {
			let bookingRecord: BookingDocument | null = null;
			await session.withTransaction(async () => {
				bookingRecord = await Booking.findById(bookingId).session(session).exec() as BookingDocument | null;
				if (!bookingRecord) throw new HttpError(404, "Booking was not found.", "NOT_FOUND");
				if (bookingRecord.status === "paid") {
					logBooking("complete free already paid", { bookingId: bookingId.toString() });
					return;
				}
				const event = await Event.findById(bookingRecord.event).session(session).exec();
				if (!event || event.status !== "published" || event.endDate <= new Date() || event.startDate <= new Date()) {
					throw new HttpError(409, "This event is no longer available.", "BOOKING_UNAVAILABLE");
				}
				const existing = await Ticket.aggregate([{ $match: { event: event._id, ticketStatus: "active" } }, { $group: { _id: "$ticketType", count: { $sum: 1 } } }]).session(session).exec();
				const sold = new Map(existing.map((item) => [item._id as string, item.count as number]));
				const total = bookingRecord!.items.reduce((sum, item) => sum + item.quantity, 0);
				if ([...sold.values()].reduce((sum, count) => sum + count, 0) + total > event.capacity) throw new HttpError(409, "This event is sold out.", "EVENT_SOLD_OUT");
				for (const item of bookingRecord!.items) {
					const type = event.ticketTypes.find((candidate) => candidate.name === item.ticketType);
					if (!type || (sold.get(item.ticketType) ?? 0) + item.quantity > type.quantity) throw new HttpError(409, `${item.ticketType} is sold out.`, "TICKET_TYPE_SOLD_OUT");
				}
				const rows = await Promise.all(bookingRecord!.items.flatMap((item) => Array.from({ length: item.quantity }, async () => {
					const number = ticketNumber();
					const qrDataUrl = await QRCode.toDataURL(`vivnt-ticket:${number}`, { width: 300, margin: 1 });
					return {
						user: bookingRecord!.user,
						event: bookingRecord!.event,
						booking: bookingRecord!._id,
						ticketType: item.ticketType,
						ticketNumber: number,
						qrCode: qrDataUrl,
						paymentStatus: "paid" as const,
						ticketStatus: "active" as const,
						checkedIn: false,
					};
				})));
				await Ticket.create(rows, { session, ordered: true });
				bookingRecord.status = "paid";
				await bookingRecord.save({ session });
				await recordActivity(bookingRecord.user, "booking", "Registered for a free event", { subject: event._id, subjectModel: "Event", link: `/event-details/${event._id}` });
			});
			await notifyCompletedBooking(bookingId, false);
			return bookingRecord ?? null;
		} finally {
			await session.endSession();
		}
	},
	completeBooking: async (bookingId: Types.ObjectId, paymentId: Types.ObjectId) => {
		await dbConnect();
		const session = await mongoose.startSession();
		logBooking("complete requested", { bookingId: bookingId.toString(), paymentId: paymentId.toString() });
		try {
			let tickets: Awaited<ReturnType<typeof Ticket.create>> = [] as never;
			await session.withTransaction(async () => {
				const booking = await Booking.findById(bookingId).session(session).exec();
				const payment = await Payment.findById(paymentId).session(session).exec();
				if (!booking || !payment) throw new HttpError(404, "Booking or payment was not found.", "NOT_FOUND");
				if (booking.status === "paid") {
					logBooking("complete already paid", { bookingId: bookingId.toString() });
					return;
				}
				
				logBooking("complete booking found", { 
					bookingId: bookingId.toString(), 
					bookingStatus: booking.status,
					itemCount: booking.items.length,
					totalQuantity: booking.items.reduce((sum, item) => sum + item.quantity, 0),
					eventId: booking.event.toString()
				});
				
				const event = await Event.findById(booking.event).session(session).exec();
				if (!event || event.status !== "published" || event.endDate <= new Date() || event.startDate <= new Date()) {
					logBooking("complete event validation failed", { 
						eventId: booking.event.toString(),
						eventExists: !!event,
						eventStatus: event?.status,
						eventStartDate: event?.startDate
					});
					throw new HttpError(409, "This event is no longer available.", "BOOKING_UNAVAILABLE");
				}
				
				const existing = await Ticket.aggregate([{ $match: { event: event._id, ticketStatus: "active" } }, { $group: { _id: "$ticketType", count: { $sum: 1 } } }]).session(session).exec();
				const sold = new Map(existing.map((item) => [item._id as string, item.count as number]));
				const total = booking.items.reduce((sum, item) => sum + item.quantity, 0);
				if ([...sold.values()].reduce((sum, count) => sum + count, 0) + total > event.capacity) throw new HttpError(409, "This event is sold out.", "EVENT_SOLD_OUT");
				for (const item of booking.items) {
					const type = event.ticketTypes.find((candidate) => candidate.name === item.ticketType);
					if (!type || (sold.get(item.ticketType) ?? 0) + item.quantity > type.quantity) throw new HttpError(409, `${item.ticketType} is sold out.`, "TICKET_TYPE_SOLD_OUT");
				}
				
				logBooking("complete capacity check passed", { 
					bookingId: bookingId.toString(),
					totalCapacityUsed: [...sold.values()].reduce((sum, count) => sum + count, 0) + total,
					eventCapacity: event.capacity
				});
				
				try {
					const rows = await Promise.all(booking.items.flatMap((item) => Array.from({ length: item.quantity }, async () => {
						const number = ticketNumber();
						const qrDataUrl = await QRCode.toDataURL(`vivnt-ticket:${number}`, { width: 300, margin: 1 });
						return {
							user: booking.user,
							event: booking.event,
							booking: booking._id,
							payment: payment._id,
							ticketType: item.ticketType,
							ticketNumber: number,
							qrCode: qrDataUrl,
							paymentStatus: "paid" as const,
							ticketStatus: "active" as const,
							checkedIn: false  // Explicitly set to false - ticket is newly created and unused
						};
					})));
					
					logBooking("complete rows generated", { 
						bookingId: bookingId.toString(),
						rowCount: rows.length
					});
					
					tickets = await Ticket.create(rows, { session, ordered: true });
					logBooking("complete tickets created", { 
						bookingId: bookingId.toString(),
						ticketCount: tickets.length
					});
				} catch (ticketError) {
					logBooking("complete ticket creation failed", { 
						bookingId: bookingId.toString(),
						error: ticketError instanceof Error ? ticketError.message : String(ticketError)
					});
					throw ticketError;
				}
				
				booking.status = "paid";
				booking.payment = payment._id;
				payment.paymentStatus = "paid";
				await Promise.all([booking.save({ session }), payment.save({ session })]);
				logBooking("complete transaction", { bookingId: booking._id.toString(), paymentId: payment._id.toString(), ticketCount: tickets.length, status: booking.status });
			});
			await notifyCompletedBooking(bookingId, true);
			return tickets;
		} finally {
			await session.endSession();
		}
	},
};
