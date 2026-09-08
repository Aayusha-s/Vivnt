import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import Event from "@/models/Event";
import Ticket from "@/models/Ticket";
import SavedEvent from "@/models/SavedEvent";
import Review from "@/models/Review";
import User from "@/models/User";
import Comment from "@/models/Comment";
import { HttpError } from "@/utils/api/httpError";
import { recordActivity } from "@/services/profiles/profile.service";
import { createNotification } from "@/services/notifications/notification.service";

const eventLookup = [
  {
    $lookup: {
      from: "events",
      localField: "event",
      foreignField: "_id",
      as: "event",
    },
  },
  { $unwind: { path: "$event", preserveNullAndEmptyArrays: false } },
  {
    $lookup: {
      from: "users",
      localField: "event.organizer",
      foreignField: "_id",
      as: "organizer",
    },
  },
  { $unwind: { path: "$organizer", preserveNullAndEmptyArrays: true } },
];
export const toggleSavedEvent = async (
  user: Types.ObjectId,
  event: Types.ObjectId,
) => {
  await dbConnect();
  if (!(await Event.exists({ _id: event })))
    throw new HttpError(404, "Event not found.", "NOT_FOUND");
  const existing = await SavedEvent.findOne({ user, event });
  if (existing) {
    await existing.deleteOne();
    return { saved: false };
  }
  await SavedEvent.create({ user, event });
  await recordActivity(user, "saved_event", "Saved an event", {
    subject: event,
    subjectModel: "Event",
    link: `/event-details/${event}`,
  });
  return { saved: true };
};
export const getSavedEvents = async (user: Types.ObjectId) =>
  SavedEvent.aggregate([
    { $match: { user } },
    ...eventLookup,
    { $match: { "event.status": { $ne: "cancelled" } } },
    {
      $project: {
        createdAt: 1,
        event: {
          _id: "$event._id",
          title: "$event.title",
          venue: "$event.venue",
          images: "$event.images",
          startDate: "$event.startDate",
          endDate: "$event.endDate",
          category: "$event.category",
          tags: "$event.tags",
          ticketTypes: "$event.ticketTypes",
          organizer: { _id: "$organizer._id", name: "$organizer.name" },
        },
      },
    },
    { $sort: { createdAt: -1 } },
  ]).exec();
export const listSavedEvents = async (
  user: Types.ObjectId,
  page: number,
  pageSize: number,
  search?: string,
  category?: string,
  date?: string,
  time?: string,
  free?: boolean,
) => {
  await dbConnect();
  const match: Record<string, unknown> = { user };
  const eventMatch: Record<string, unknown> = {
    "event.status": { $nin: ["cancelled", "completed"] },
    "event.approvalStatus": "approved",
  };
  if (category) eventMatch["event.category"] = category;
  const startDate: Record<string, Date> = {};
  if (date) {
    startDate.$gte = new Date(`${date}T00:00:00`);
    startDate.$lte = new Date(`${date}T23:59:59.999`);
  }
  if (time === "upcoming") startDate.$gte = new Date();
  if (Object.keys(startDate).length) eventMatch["event.startDate"] = startDate;
  if (time === "past") eventMatch["event.endDate"] = { $lt: new Date() };
  if (free !== undefined)
    eventMatch["event.ticketTypes"] = {
      $elemMatch: { price: free ? 0 : { $gt: 0 } },
    };
  if (search) {
    const pattern = new RegExp(
      search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    eventMatch.$or = [
      { "event.title": pattern },
      { "event.venue": pattern },
      { "event.tags": pattern },
    ];
  }
  const pipeline = [
    { $match: match },
    ...eventLookup,
    { $match: eventMatch },
    {
      $project: {
        createdAt: 1,
        event: {
          _id: "$event._id",
          title: "$event.title",
          venue: "$event.venue",
          images: "$event.images",
          startDate: "$event.startDate",
          endDate: "$event.endDate",
          category: "$event.category",
          tags: "$event.tags",
          ticketTypes: "$event.ticketTypes",
          organizer: { _id: "$organizer._id", name: "$organizer.name" },
        },
      },
    },
    { $sort: { createdAt: -1 as const } },
  ];
  const [result] = await SavedEvent.aggregate([
    ...pipeline,
    {
      $facet: {
        items: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }],
        meta: [{ $count: "total" }],
      },
    },
  ]);
  const total = result?.meta[0]?.total ?? 0;
  return {
    items: result?.items ?? [],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
};
const attended = (user: Types.ObjectId, event: Types.ObjectId) =>
  Ticket.exists({ user, event, paymentStatus: "paid", ticketStatus: "active" });
export const upsertReview = async (
  user: Types.ObjectId,
  event: Types.ObjectId,
  rating: number,
  text: string,
) => {
  await dbConnect();
  const cleanText = text.trim();
  if (!cleanText)
    throw new HttpError(400, "Review text is required.", "VALIDATION_ERROR");
  if (!(await attended(user, event)))
    throw new HttpError(
      403,
      "Only paid event attendees may review this event.",
      "ATTENDANCE_REQUIRED",
    );
  const existingReview = await Review.exists({ user, event });
  const review = await Review.findOneAndUpdate(
    { user, event },
    { rating, text: cleanText },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  const eventRecord = await Event.findById(event).select("title organizer").lean().exec();
  if (!existingReview && eventRecord && !eventRecord.organizer.equals(user)) {
    const reviewer = await User.findById(user).select("name").lean().exec();
    createNotification(
      eventRecord.organizer,
      "review",
      "New event review",
      `${reviewer?.name ?? "An attendee"} reviewed ${eventRecord.title}.`,
      `/event-details/${event}`,
    ).catch(console.error);
  }
  await recordActivity(user, "review", "Reviewed an event", {
    subject: review._id,
    subjectModel: "Review",
    link: `/event-details/${event}`,
  });
  return review;
};
export const deleteReview = async (
  user: Types.ObjectId,
  id: Types.ObjectId,
) => {
  await dbConnect();
  const review = await Review.findOneAndDelete({ _id: id, user });
  if (!review) throw new HttpError(404, "Review not found.", "NOT_FOUND");
};
export const getReviews = async (event: Types.ObjectId) =>
  Review.aggregate([
    { $match: { event } },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        rating: 1,
        text: 1,
        createdAt: 1,
        updatedAt: 1,
        user: {
          _id: "$user._id",
          name: "$user.name",
          profileImage: "$user.profileImage",
        },
      },
    },
    { $sort: { createdAt: -1 } },
  ]).exec();
export const getReviewSummary = async (event: Types.ObjectId) => {
  const [summary] = await Review.aggregate([
    { $match: { event } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);
  return {
    averageRating: summary?.averageRating ?? 0,
    reviewCount: summary?.reviewCount ?? 0,
  };
};
export const listComments = async (event: Types.ObjectId) =>
  Comment.aggregate([
    { $match: { event } },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        event: 1,
        parent: 1,
        text: 1,
        likes: 1,
        dislikes: 1,
        createdAt: 1,
        updatedAt: 1,
        user: {
          _id: "$user._id",
          name: "$user.name",
          profileImage: "$user.profileImage",
        },
      },
    },
    { $sort: { createdAt: 1 } },
  ]).exec();
export const createComment = async (
  user: Types.ObjectId,
  event: Types.ObjectId,
  text: string,
  parent?: Types.ObjectId,
) => {
  await dbConnect();
  if (parent && !(await Comment.exists({ _id: parent, event })))
    throw new HttpError(400, "Reply target is invalid.", "VALIDATION_ERROR");
  const comment = await Comment.create({ user, event, text, parent });
  await recordActivity(user, "comment", "Commented on an event", {
    subject: comment._id,
    subjectModel: "Comment",
    link: `/event-details/${event}`,
  });
  return comment;
};
export const updateComment = async (
  user: Types.ObjectId,
  id: Types.ObjectId,
  text: string,
) => {
  const comment = await Comment.findOneAndUpdate(
    { _id: id, user },
    { text },
    { new: true, runValidators: true },
  );
  if (!comment) throw new HttpError(404, "Comment not found.", "NOT_FOUND");
  return comment;
};
export const deleteComment = async (
  user: Types.ObjectId,
  id: Types.ObjectId,
) => {
  const comment = await Comment.findOne({ _id: id, user });
  if (!comment) throw new HttpError(404, "Comment not found.", "NOT_FOUND");
  await Comment.deleteMany({ $or: [{ _id: id }, { parent: id }] });
};
export const reactToComment = async (
  user: Types.ObjectId,
  id: Types.ObjectId,
  reaction: "like" | "dislike",
) => {
  const opposite = reaction === "like" ? "dislikes" : "likes";
  const target = reaction === "like" ? "likes" : "dislikes";
  const comment = await Comment.findByIdAndUpdate(
    id,
    { $pull: { [opposite]: user }, $addToSet: { [target]: user } },
    { new: true },
  );
  if (!comment) throw new HttpError(404, "Comment not found.", "NOT_FOUND");
  if (reaction === "like")
    await recordActivity(user, "like", "Liked a comment", {
      subject: comment._id,
      subjectModel: "Comment",
    });
  return comment;
};
export const getAttendeeDashboard = async (user: Types.ObjectId) => {
  await dbConnect();
  const now = new Date();
  const [tickets, savedEvents, reviews] = await Promise.all([
    Ticket.aggregate([
      { $match: { user } },
      ...eventLookup,
      {
        $project: {
          ticketNumber: 1,
          ticketType: 1,
          qrCode: 1,
          paymentStatus: 1,
          ticketStatus: 1,
          checkedIn: 1,
          purchaseDate: 1,
          event: {
            _id: "$event._id",
            title: "$event.title",
            venue: "$event.venue",
            images: "$event.images",
            startDate: "$event.startDate",
            endDate: "$event.endDate",
            category: "$event.category",
            organizer: { name: "$organizer.name" },
          },
        },
      },
      { $sort: { purchaseDate: -1 } },
    ]),
    getSavedEvents(user),
    Review.aggregate([
      { $match: { user } },
      ...eventLookup,
      {
        $project: {
          rating: 1,
          text: 1,
          createdAt: 1,
          event: { _id: "$event._id", title: "$event.title" },
        },
      },
      { $sort: { createdAt: -1 } },
    ]),
  ]);
  const active = tickets.filter(
    (t) => t.ticketStatus === "active" && t.paymentStatus === "paid",
  );
  const upcoming = active.filter((t) => new Date(t.event.startDate) >= now);
  const past = active.filter((t) => new Date(t.event.endDate) < now);
  const spending = await Ticket.aggregate([
    { $match: { user, paymentStatus: "paid", ticketStatus: "active" } },
    {
      $lookup: {
        from: "bookings",
        localField: "booking",
        foreignField: "_id",
        as: "booking",
      },
    },
    { $unwind: { path: "$booking", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: null,
        total: { $sum: { $ifNull: ["$booking.totalAmount", 0] } },
      },
    },
  ]);
  return {
    upcoming,
    past,
    activeTickets: active,
    savedEvents,
    recentBookings: tickets.slice(0, 5),
    recentReviews: reviews.slice(0, 5),
    totalEventsAttended: active.filter((t) => t.checkedIn).length,
    favoriteCategories: [...new Set(active.map((t) => t.event.category))],
    favoriteOrganizers: [
      ...new Set(active.map((t) => t.event.organizer?.name).filter(Boolean)),
    ],
    spending: spending[0]?.total ?? 0,
  };
};
