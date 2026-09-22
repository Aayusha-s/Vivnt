"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, Eye, MapPin, Store, TriangleAlert } from "lucide-react";
import Button from "@/components/Button";
type Event = {
  _id: string;
  title: string;
  startDate: string;
  venue: string;
  images?: string[];
  organizer?: { name?: string };
};
type Booking = { event: Event | null; stallName?: string; status: string };
export default function VendorEventsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/vendors/events", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok || !j.success)
          throw new Error(
            j.error?.message || "Unable to load assigned events.",
          );
        setBookings(j.data);
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Unable to load assigned events.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  return (
    <section className="app-page font-cause text-text-dark">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Vendor workspace</p>
          <h1 className="mt-1 font-dynapuff text-2xl font-bold md:text-3xl">My Events</h1>
          <p className="mt-1 max-w-xl text-sm text-text-light">
            Keep track of every event connected to your stall bookings.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm shadow-xs">
          <Store className="h-4 w-4 text-primary" />
          <span className="font-semibold">{bookings.length}</span>
          <span className="text-text-light">assigned events</span>
        </div>
      </div>
      {error && (
        <p className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
          <TriangleAlert className="mr-2 inline" size={18} />
          {error}
        </p>
      )}
      {loading ? (
        <p className="mt-6">Loading assigned events...</p>
      ) : bookings.length === 0 ? (
        <div className="mt-6 rounded-xl border border-brown-normal p-8 text-center">
          No assigned events yet.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {bookings.map(
            (b) =>
              b.event && (
                <article
                  key={b.event._id}
                  className="surface-card interactive-card overflow-hidden"
                >
                  <div className="flex min-h-0 flex-col sm:flex-row">
                  <div className="h-32 shrink-0 bg-brown-light sm:h-auto sm:w-40">
                    {b.event.images?.[0] && (
                      <img
                        src={b.event.images[0]}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="line-clamp-2 font-dynapuff text-lg font-bold leading-tight">{b.event.title}</h2>
                      <span className="shrink-0 rounded-full bg-primary-light px-2.5 py-1 text-[11px] font-semibold capitalize text-primary-active">
                        {b.status}
                      </span>
                    </div>
                    <p className="mt-3 truncate text-xs text-text-light">
                      <Calendar className="mr-1 inline h-3.5 w-3.5 text-primary" />
                      {new Date(b.event.startDate).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    <p className="mt-1 truncate text-xs text-text-light">
                      <MapPin className="mr-1 inline h-3.5 w-3.5 text-primary" />
                      {b.event.venue}
                    </p>
                    <p className="mt-2 truncate text-xs text-text-light">
                      {b.stallName ? `Stall: ${b.stallName}` : `Organizer: ${b.event.organizer?.name ?? "Event organizer"}`}
                    </p>
                    <div className="mt-4">
                      <Link href={`/vendor/events/${b.event._id}`}>
                        <Button
                          text="View Details"
                          size="sm"
                          iconLeft={<Eye size={16} />}
                        />
                      </Link>
                    </div>
                  </div>
                  </div>
                </article>
              ),
          )}
        </div>
      )}
    </section>
  );
}
