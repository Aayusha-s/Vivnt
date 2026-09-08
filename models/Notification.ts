import mongoose, { HydratedDocument, Model, Schema, Types } from "mongoose";

export interface INotification {
	user: Types.ObjectId;
	type: "registration" | "booking" | "payment_success" | "event_reminder" | "event_approval" | "event_update" | "event_cancelled" | "ticket_booking" | "review" | "organizer_update" | "admin_update" | "vendor_update" | "stall_update" | "stall_application" | "follow" | "stall_opportunity" | "stall_deadline" | "ticket_checkin";
	title: string;
	message: string;
	read: boolean;
	link?: string;
	createdAt: Date;
}

export type NotificationDocument = HydratedDocument<INotification>;

const notificationSchema = new Schema<INotification>(
	{
		user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
		type: {
			type: String,
			enum: ["registration", "booking", "payment_success", "event_reminder", "event_approval", "event_update", "event_cancelled", "ticket_booking", "review", "organizer_update", "admin_update", "vendor_update", "stall_update", "stall_application", "follow", "stall_opportunity", "stall_deadline", "ticket_checkin"],
			required: true,
		},
		title: { type: String, required: true, trim: true, maxlength: 200 },
		message: { type: String, required: true, trim: true, maxlength: 1000 },
		read: { type: Boolean, default: false, required: true, index: true },
		link: { type: String, trim: true, maxlength: 500 },
	},
	{ timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export const Notification: Model<INotification> =
	(mongoose.models.Notification as Model<INotification> | undefined) ?? mongoose.model<INotification>("Notification", notificationSchema);

export default Notification;
