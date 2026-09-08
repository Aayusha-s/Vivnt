import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import Notification, { INotification } from "@/models/Notification";
import Ticket from "@/models/Ticket";
import Event from "@/models/Event";

export const createNotification = async (
  userId: Types.ObjectId | string,
  type: INotification["type"],
  title: string,
  message: string,
  link?: string,
) => {
  await dbConnect();
  return Notification.create({
    user: new Types.ObjectId(userId),
    type,
    title,
    message,
    link,
  });
};

export const createNotificationOnce = async (
  userId: Types.ObjectId | string,
  type: INotification["type"],
  title: string,
  message: string,
  link?: string,
) => {
  await dbConnect();
  const user = new Types.ObjectId(userId);
  if (await Notification.exists({ user, type, title, link })) return null;
  return Notification.create({ user, type, title, message, link });
};

export const getUserNotifications = async (
  userId: Types.ObjectId | string,
  page = 1,
  pageSize = 20,
  query?: string,
  type?: string,
) => {
  await dbConnect();
  const userObjId = new Types.ObjectId(userId);
  await createUpcomingEventReminders(userObjId);
  const skip = (page - 1) * pageSize;
  const filter: Record<string, unknown> = { user: userObjId };
  if (type) filter.type = type;
  if (query) {
    const pattern = new RegExp(
      query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    filter.$or = [{ title: pattern }, { message: pattern }];
  }

  const [notifications, unreadCount, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean()
      .exec(),
    Notification.countDocuments({ user: userObjId, read: false }),
    Notification.countDocuments({ user: userObjId }),
  ]);

  return {
    items: notifications,
    unreadCount,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
};

const createUpcomingEventReminders = async (userId: Types.ObjectId) => {
  const now = new Date();
  const within = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tickets = await Ticket.find({ user: userId, ticketStatus: "active", paymentStatus: "paid" })
    .distinct("event")
    .exec();
  if (!tickets.length) return;
  const events = await Event.find({ _id: { $in: tickets }, status: "published", approvalStatus: "approved", startDate: { $gte: now, $lte: within } })
    .select("title startDate")
    .lean()
    .exec();
  await Promise.all(events.map((event) => createNotificationOnce(
    userId,
    "event_reminder",
    `Event reminder: ${event.title}`,
    `Your event starts on ${new Date(event.startDate).toLocaleString()}.`,
    `/event-details/${event._id}`,
  )));
};

export const deleteNotification = async (
  notificationId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
) => {
  await dbConnect();
  return Notification.deleteOne({ _id: notificationId, user: userId }).exec();
};
export const deleteAllNotifications = async (
  userId: Types.ObjectId | string,
) => {
  await dbConnect();
  return Notification.deleteMany({ user: userId }).exec();
};

export const markNotificationAsRead = async (
  notificationId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
) => {
  await dbConnect();
  return Notification.findOneAndUpdate(
    {
      _id: new Types.ObjectId(notificationId),
      user: new Types.ObjectId(userId),
    },
    { $set: { read: true } },
    { new: true },
  ).exec();
};

export const markAllNotificationsAsRead = async (
  userId: Types.ObjectId | string,
) => {
  await dbConnect();
  await Notification.updateMany(
    { user: new Types.ObjectId(userId), read: false },
    { $set: { read: true } },
  ).exec();
  return { success: true };
};
