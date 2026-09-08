"use client";
import Button from "@/components/Button";
import Tickets from "@/components/Tickets";
import { Calendar, Check, Clock, MapPin } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { formatPersonName } from "@/utils/formatPersonName";

type TicketType = {
  name: string;
  price: number;
  quantity: number;
  remaining?: number;
  description?: string;
};
type EventData = {
  _id: string;
  title: string;
  venue: string;
  images: string[];
  startDate: string;
  endDate: string;
  capacity: number;
  ticketsSold?: number;
  ticketTypes: TicketType[];
  organizer?: { name?: string };
};
type Details = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};
const date = (v: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(v));
const time = (v: string) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(v));
function BookNowContent() {
  const { data: session, status: sessionStatus } = useSession(),
    params = useSearchParams(),
    router = useRouter(),
    eventId = params.get("eventId"),
    paymentId = params.get("paymentId"),
    key = `vivnt-booking:${eventId}`;
  const [event, setEvent] = useState<EventData | null>(null),
    [quantities, setQuantities] = useState<Record<string, number>>({}),
    [step, setStep] = useState<
      "tickets" | "details" | "payments" | "confirmBooking"
    >("tickets"),
    [details, setDetails] = useState<Details>({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
    }),
    [error, setError] = useState(params.get("paymentError") ?? ""),
    [loading, setLoading] = useState(true),
    [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!eventId) {
      setError("Event not found.");
      setLoading(false);
      return;
    }
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const flow = JSON.parse(saved);
        setQuantities(flow.quantities ?? {});
        setDetails(flow.details ?? {});
        setStep(flow.step ?? "tickets");
      }
    } catch {
      localStorage.removeItem(key);
    }
    fetch(`/api/events/${eventId}`)
      .then(async (r) => ({ ok: r.ok, data: await r.json() }))
      .then(({ ok, data }) => {
        if (!ok || !data.success)
          throw new Error(data.error?.message || "Event not found.");
        setEvent(data.data);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Unable to load event."),
      )
      .finally(() => setLoading(false));
  }, [eventId, key]);
  const selected = useMemo(
    () =>
      event?.ticketTypes
        .filter((type) => (quantities[type.name] ?? 0) > 0)
        .map((type) => ({
          ticketType: type.name,
          quantity: quantities[type.name],
          price: type.price,
        })) ?? [],
    [event, quantities],
  );
  const subtotal = selected.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const remainingCapacity = Math.max(
    0,
    (event?.capacity ?? 0) - (event?.ticketsSold ?? 0),
  );
  useEffect(() => {
    if (eventId)
      localStorage.setItem(key, JSON.stringify({ quantities, details, step }));
  }, [details, eventId, key, quantities, step]);
  useEffect(() => {
    if (paymentId && params.get("settled") === "1") {
      setStep("confirmBooking");
      localStorage.removeItem(key);
    }
  }, [key, params, paymentId]);
  const updateQuantity = (type: TicketType, value: number) => {
    const other = Object.entries(quantities)
      .filter(([name]) => name !== type.name)
      .reduce((sum, [, quantity]) => sum + quantity, 0);
    const limit = Math.max(
      0,
      Math.min(type.remaining ?? type.quantity, remainingCapacity - other),
    );
    const quantity = Math.max(
      0,
      Math.min(limit, Number.isFinite(value) ? Math.floor(value) : 0),
    );
    setQuantities((current) => ({ ...current, [type.name]: quantity }));
  };
  const startPayment = async () => {
    if (!event || selected.length === 0) {
      setError("Select at least one ticket to continue.");
      return;
    }
    if (Object.values(details).some((value) => !value?.trim())) {
      setError("Please complete your contact details.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const bookingResponse = await fetch("/api/tickets/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event._id,
          items: selected.map(({ ticketType, quantity }) => ({
            ticketType,
            quantity,
          })),
        }),
      });
      const booking = await bookingResponse.json();
      if (!bookingResponse.ok || !booking.success)
        throw new Error(booking.error?.message || "Unable to create booking.");
      if (Number(booking.data.totalAmount ?? subtotal) === 0) {
        setStep("confirmBooking");
        localStorage.removeItem(key);
        return;
      }
      const paymentResponse = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.data._id,
          paymentMethod: "esewa",
        }),
      });
      const payment = await paymentResponse.json();
      if (!paymentResponse.ok || !payment.success)
        throw new Error(
          payment.error?.message || "Unable to start eSewa payment.",
        );
      const form = document.createElement("form");
      form.method = "POST";
      form.action = payment.data.paymentUrl;
      Object.entries(payment.data.formData).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = String(value);
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to complete booking.");
    } finally {
      setSubmitting(false);
    }
  };
  if (sessionStatus === "authenticated" && session?.user?.role !== "attendee")
    return (
      <section className="my-4 mx-2 px-4 font-cause text-text-dark">
        <h1 className="text-2xl font-bold">Ticket booking is for attendees</h1>
        <p className="mt-2 text-text-light">
          Your role can browse events, but cannot purchase attendee tickets.
        </p>
      </section>
    );
  if (loading)
    return (
      <section className="my-4 mx-2 px-4 font-cause text-text-dark">
        Loading event…
      </section>
    );
  if (!event)
    return (
      <section className="my-4 mx-2 px-4 font-cause text-text-dark">
        {error}
      </section>
    );
  return (
    <section className="flex flex-col my-4 mx-2 px-4 font-cause text-text-dark md:my-3 md:mx-3 md:px-3 lg:my-4 lg:mx-4 lg:px-4 xl:my-6 xl:mx-6 xl:px-6 2xl:my-8 2xl:mx-8 2xl:px-8">
      <div className="grid grid-cols-1 md:grid-cols-[3fr_1fr] gap-4">
        <div>
          <div className="border border-brown-normal rounded-xl p-4 flex flex-col gap-4 md:flex-row">
            <div className="w-full md:w-[200px] md:h-[130px] lg:w-[300px] lg:h-[200px] overflow-hidden rounded-2xl">
              <img
                src={event.images[0] ?? "/images/business.png"}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-semibold my-2">{event.title}</h1>
              <p className="text-sm mb-2">
                Hosted by {formatPersonName(event.organizer?.name ?? "Event organizer")} •{" "}
                {remainingCapacity} seats left
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex flex-row items-center gap-2">
                  <Calendar size={18} />
                  <p>{date(event.startDate)}</p>
                </div>
                <div className="flex flex-row items-center gap-2">
                  <Clock size={18} />
                  <p>
                    {time(event.startDate)} - {time(event.endDate)}
                  </p>
                </div>
                <div className="flex flex-row items-center gap-2">
                  <MapPin size={18} />
                  <p>{event.venue}</p>
                </div>
              </div>
            </div>
          </div>
          {error && <p className="mt-4 text-red-600">{error}</p>}
          {step === "tickets" && (
            <div className="border border-brown-normal p-4 rounded-xl mt-4">
              <h3 className="font-bold mb-4">Select Tickets</h3>
              <div className="flex flex-col gap-4">
                {event.ticketTypes.map((type) => {
                  const available = Math.min(
                    type.remaining ?? type.quantity,
                    remainingCapacity -
                      Object.entries(quantities)
                        .filter(([name]) => name !== type.name)
                        .reduce((sum, [, quantity]) => sum + quantity, 0),
                  );
                  return (
                    <div
                      key={type.name}
                      className={available <= 0 ? "opacity-60" : ""}
                    >
                      <Tickets
                        title={type.name}
                        subtitle={
                          available <= 0 ? "Sold Out" : (type.description ?? "")
                        }
                        price={type.price}
                        remainingTickets={Math.max(0, available)}
                        features={type.description ? [type.description] : []}
                        quantity={quantities[type.name] ?? 0}
                        onQuantityChange={(quantity) =>
                          updateQuantity(type, quantity)
                        }
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  text="Continue to Details"
                  variant="cta"
                  size="md"
                  disabled={selected.length === 0}
                  onClick={() => setStep("details")}
                />
              </div>
            </div>
          )}
          {step === "details" && (
            <div className="border border-brown-normal p-4 rounded-xl mt-4">
              <h3 className="font-bold mb-4">Your Details</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(
                  [
                    ["firstName", "First Name"],
                    ["lastName", "Last Name"],
                    ["email", "Email"],
                    ["phone", "Phone Number"],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field} className="flex flex-col">
                    <label className="mb-1">{label}</label>
                    <input
                      value={details[field] ?? ""}
                      onChange={(e) =>
                        setDetails((current) => ({
                          ...current,
                          [field]: e.target.value,
                        }))
                      }
                      className="border border-brown-normal rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brown-normal"
                      placeholder={`Enter your ${label.toLowerCase()}`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-4 mt-4">
                <Button
                  text="Back"
                  variant="cta"
                  size="md"
                  onClick={() => setStep("tickets")}
                />
                <Button
                  text="Continue to Payments"
                  variant="cta"
                  size="md"
                  onClick={() => setStep("payments")}
                />
              </div>
            </div>
          )}
          {step === "payments" && (
            <div className="border border-brown-normal p-4 rounded-xl mt-4">
              <h3 className="font-bold mb-4">Payment Details</h3>
              <p className="mb-4">
                You will be redirected to eSewa to complete this payment
                securely.
              </p>
              <div className="flex justify-end gap-4 mt-4">
                <Button
                  text="Back"
                  variant="cta"
                  size="md"
                  onClick={() => setStep("details")}
                />
                <Button
                  text={
                    submitting
                      ? "Redirecting…"
                      : `Pay Rs. ${subtotal.toLocaleString()} with eSewa`
                  }
                  variant="cta"
                  size="md"
                  disabled={submitting}
                  onClick={startPayment}
                />
              </div>
            </div>
          )}
          {step === "confirmBooking" && (
            <div className="border border-brown-normal p-4 rounded-xl mt-4 flex flex-col items-center text-center">
              <Check size={48} className="text-green-500 mb-4" />
              <h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2>
              <p className="mb-4">
                Your eSewa payment for {event.title} has been confirmed.
              </p>
              <Button
                text="View My Tickets"
                variant="cta"
                size="md"
                onClick={() => router.push("/userdashboard")}
              />
            </div>
          )}
        </div>
        <div className="relative">
          <div className="sticky top-4 w-full border border-brown-normal rounded-xl p-4">
            <h3 className="font-bold">Order Summary</h3>
            <div className="flex flex-col gap-4 my-4">
              {selected.length ? (
                selected.map((item) => (
                  <div
                    key={item.ticketType}
                    className="flex flex-row justify-between"
                  >
                    <p>
                      {item.ticketType} x {item.quantity}
                    </p>
                    <p>Rs. {(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                ))
              ) : (
                <p>Select tickets to continue.</p>
              )}
              <div className="w-full h-0.5 bg-brown-light-hover my-2" />
              <div className="flex flex-row justify-between">
                <p>Subtotal</p>
                <p>Rs. {subtotal.toLocaleString()}</p>
              </div>
              <div className="flex flex-row justify-between">
                <p>Service Fee</p>
                <p>Rs. 0</p>
              </div>
              <div className="w-full h-0.5 bg-brown-light-hover my-2" />
              <div className="flex flex-row justify-between font-bold">
                <p>Grand Total</p>
                <p>Rs. {subtotal.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
export default function Page() {
  return (
    <Suspense
      fallback={
        <section className="my-4 mx-2 px-4 font-cause text-text-dark">
          Loading event…
        </section>
      }
    >
      <BookNowContent />
    </Suspense>
  );
}
