"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock3, MapPin, Ticket, TriangleAlert } from "lucide-react";
import Button from "@/components/Button";
import Map from "@/components/Map";

type TicketType = { name: string; price: number; quantity: number; description?: string };
type EventData = {
  _id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  venue?: string;
  latitude?: number;
  longitude?: number;
  category: string;
  status: string;
  isOnline?: boolean;
  organizer?: { name?: string; profileImage?: string };
  images?: string[];
  ticketTypes?: TicketType[];
  capacity?: number;
  ticketsSold?: number;
  tags?: string[];
};
type Data = {
  stallName?: string;
  status: string;
  event: EventData;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(value));
const formatTime = (value: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
const fallbackImage = "/images/party.png";

const getMapUrl = (event: EventData) => {
  const readableLocation = event.venue?.trim();
  const hasCoordinates =
    typeof event.latitude === "number" &&
    typeof event.longitude === "number" &&
    (event.latitude !== 0 || event.longitude !== 0);
  const mapQuery = readableLocation || (hasCoordinates ? `${event.latitude},${event.longitude}` : "");
  return mapQuery ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed` : undefined;
};

export default function VendorEventDetails({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then(({ id }) =>
      fetch(`/api/vendors/events/${id}`, { cache: "no-store" })
        .then(async (r) => {
          const j = await r.json();
          if (!r.ok || !j.success)
            throw new Error(
              j.error?.message || "Unable to load assigned event.",
            );
          setData(j.data);
        })
        .catch((e) =>
          setError(
            e instanceof Error ? e.message : "Unable to load assigned event.",
          ),
        ),
    );
  }, [params]);

  const details = useMemo(() => {
    if (!data?.event) return [];
    const event = data.event;
    const eventStatus = event.status ? event.status.toLowerCase() : "upcoming";
    const organizerName = event.organizer?.name ?? "Event organizer";
    const ticketPrice = event.ticketTypes?.length
      ? Math.min(...event.ticketTypes.map((ticket) => ticket.price))
      : 0;
    const seatsLeft = event.capacity && event.ticketsSold !== undefined
      ? Math.max(0, event.capacity - event.ticketsSold)
      : 0;

    return [
      { label: "Date", value: formatDate(event.startDate) },
      { label: "Time", value: `${formatTime(event.startDate)} - ${formatTime(event.endDate)}` },
      { label: "Location", value: event.isOnline ? "Online event" : event.venue || "Location unavailable" },
      { label: "Organizer", value: organizerName },
      { label: "Price", value: event.ticketTypes?.some((ticket) => ticket.price === 0) ? "Free tickets available" : `From Rs. ${ticketPrice.toLocaleString()}` },
      { label: "Seats", value: seatsLeft > 0 ? `${seatsLeft.toLocaleString()} remaining of ${event.capacity?.toLocaleString() ?? "0"}` : "Fully booked" },
      { label: "Assigned vendor status", value: data.status ? data.status.toUpperCase() : eventStatus.toUpperCase() },
      { label: "Event status", value: event.status },
    ];
  }, [data]);

  const mapUrl = data?.event ? getMapUrl(data.event) : undefined;

  return (
    <section className="app-page font-cause text-text-dark">
      <Link href="/vendor/events">
        <Button
          text="Back to My Events"
          variant="secondary"
          size="sm"
          iconLeft={<ArrowLeft size={16} />}
        />
      </Link>
      {error && (
        <p className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
          <TriangleAlert className="mr-2 inline" size={18} />
          {error}
        </p>
      )}
      {!data && !error && <p className="mt-6">Loading assigned event...</p>}
      {data && (
        <article className="surface-elevated mt-5 overflow-hidden">
          <div className="grid lg:grid-cols-[minmax(220px,32%)_1fr]">
          <div className="relative h-52 bg-brown-light sm:h-64 lg:h-full lg:min-h-[260px]">
            {data.event.images?.[0] ? (
              <img
                src={data.event.images[0]}
                alt={data.event.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src={fallbackImage}
                alt={data.event.title}
                className="h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
            <div className="absolute left-4 top-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-text-dark">
                Assigned event
              </span>
              <span className="rounded-full bg-brown-normal px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                {data.status}
              </span>
            </div>
          </div>

          <div className="min-w-0 p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm capitalize text-text-light">
                  {data.event.category}
                </p>
                <h1 className="mt-1 font-dynapuff text-2xl font-bold leading-tight md:text-3xl">
                  {data.event.title}
                </h1>
              </div>
              <span className="rounded-full bg-brown-light px-3 py-1 text-sm capitalize">
                Assigned to vendor
              </span>
            </div>

            <div className="mt-5 grid gap-2 border-y border-border py-4 text-sm sm:grid-cols-2">
              <p className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span><b>Starts</b><br />{new Date(data.event.startDate).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
              </p>
              <p className="flex items-start gap-2">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span><b>Ends</b><br />{new Date(data.event.endDate).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
              </p>
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span><b>Location</b><br />
                {data.event.isOnline ? "Online event" : data.event.venue || "Location unavailable"}
                </span>
              </p>
              <p><b>Organizer</b><br />{data.event.organizer?.name ?? "Event organizer"}
              </p>
              {data.stallName && (
                <p><b>Your stall</b><br />{data.stallName}
                </p>
              )}
              <p><b>Event status</b><br />
                <span className="capitalize">{data.event.status}</span>
              </p>
            </div>

            <div className="mt-5 grid gap-2 rounded-xl bg-background p-3 sm:grid-cols-2 lg:grid-cols-4">
              {details.map((item) => (
                <div key={item.label} className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-light">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-snug text-text-dark">{item.value}</p>
                </div>
              ))}
            </div>

            {mapUrl && (
              <div className="mt-6">
                <Map mapId={1} mapUrl={mapUrl} />
              </div>
            )}

            <div className="mt-6 border-t border-border pt-5">
              <h2 className="font-dynapuff text-lg">Event Description</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-light">
                {data.event.description}
              </p>
            </div>

            {data.event.ticketTypes && data.event.ticketTypes.length > 0 && (
              <div className="mt-6 border-t border-border pt-5">
                <h2 className="font-dynapuff text-lg"><Ticket className="mr-2 inline h-5 w-5 text-primary" />Tickets</h2>
                <div className="mt-3 space-y-2">
                  {data.event.ticketTypes.map((ticket) => (
                    <div key={`${ticket.name}-${ticket.price}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
                      <div>
                        <p className="font-semibold text-text-dark">{ticket.name}</p>
                        {ticket.description && (
                          <p className="mt-1 text-sm text-text-light">{ticket.description}</p>
                        )}
                        <p className="mt-1 text-xs text-text-light">{ticket.quantity} available</p>
                      </div>
                      <p className="text-sm font-bold text-brown-normal">
                        {ticket.price === 0 ? "Free" : `Rs. ${ticket.price.toLocaleString()}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          </div>
        </article>
      )}
    </section>
  );
}
