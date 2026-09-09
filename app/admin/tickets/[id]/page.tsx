"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Ticket = {
  _id: string;
  ticketNumber: string;
  ticketType: string;
  qrCode: string;
  paymentStatus: string;
  ticketStatus: string;
  checkedIn: boolean;
  checkedInAt?: string;
  purchaseDate: string;
  user?: { name?: string; email?: string; phone?: string };
  event?: { _id?: string; title?: string; venue?: string; startDate?: string; endDate?: string; organizer?: { name?: string; email?: string } };
  payment?: { amount?: number; paymentMethod?: string; paymentStatus?: string; transactionId?: string };
};

export default function AdminTicketDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/tickets/${id}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error?.message ?? "Unable to load ticket.");
        setTicket(result.data);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load ticket."))
      .finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (ticketStatus: "active" | "cancelled") => {
    const response = await fetch(`/api/admin/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketStatus }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      setError(result.error?.message ?? "Unable to update ticket.");
      return;
    }
    setTicket((current) => (current ? { ...current, ticketStatus } : current));
    setMessage("Ticket status updated.");
  };

  if (loading) return <section className="mx-auto max-w-5xl px-4 py-12">Loading ticket...</section>;
  if (error || !ticket) return <section className="mx-auto max-w-5xl px-4 py-12 text-error">{error || "Ticket not found."}</section>;

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 font-cause text-text-dark">
      <Link href="/admin/tickets" className="text-sm font-semibold text-primary hover:underline">
        ← Back to tickets
      </Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-dynapuff text-3xl font-semibold">Ticket details</h1>
          <p className="mt-1 text-text-light">{ticket.ticketNumber}</p>
        </div>
        <span className="rounded-full bg-primary-light px-3 py-1 text-sm capitalize text-primary">
          {ticket.ticketStatus}
        </span>
      </div>

      {message && <p className="mt-4 text-green-700">{message}</p>}

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 text-lg font-semibold">Ticket and attendee</h2>
            <p><strong>Ticket type:</strong> {ticket.ticketType}</p>
            <p><strong>Attendee:</strong> {ticket.user?.name ?? "-"}</p>
            <p><strong>Email:</strong> {ticket.user?.email ?? "-"}</p>
            <p><strong>Phone:</strong> {ticket.user?.phone ?? "-"}</p>
            <p><strong>Purchased:</strong> {new Date(ticket.purchaseDate).toLocaleString()}</p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 text-lg font-semibold">Event and organizer</h2>
            <p><strong>Event:</strong> {ticket.event?.title ?? "-"}</p>
            <p><strong>Venue:</strong> {ticket.event?.venue ?? "-"}</p>
            <p><strong>Start:</strong> {ticket.event?.startDate ? new Date(ticket.event.startDate).toLocaleString() : "-"}</p>
            <p><strong>Organizer:</strong> {ticket.event?.organizer?.name ?? "-"}</p>
            <p><strong>Organizer email:</strong> {ticket.event?.organizer?.email ?? "-"}</p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 text-lg font-semibold">Payment</h2>
            <p><strong>Status:</strong> {ticket.payment?.paymentStatus ?? ticket.paymentStatus}</p>
            <p><strong>Method:</strong> {ticket.payment?.paymentMethod ?? "-"}</p>
            <p><strong>Amount:</strong> {ticket.payment?.amount !== undefined ? `Rs. ${ticket.payment.amount.toLocaleString()}` : "-"}</p>
            <p><strong>Transaction:</strong> {ticket.payment?.transactionId ?? "-"}</p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-surface p-5 text-center">
            <h2 className="mb-4 text-lg font-semibold">QR code</h2>
            <img src={ticket.qrCode} alt="Ticket QR code" className="mx-auto h-64 w-64 rounded-lg border border-border" />
            <p className="mt-3 text-sm text-text-light">{ticket.checkedIn ? "Checked in" : "Not checked in"}</p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 text-lg font-semibold">Check-in information</h2>
            <p><strong>Status:</strong> {ticket.checkedIn ? "Successful" : "Pending"}</p>
            <p><strong>Checked in at:</strong> {ticket.checkedInAt ? new Date(ticket.checkedInAt).toLocaleString() : "-"}</p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 text-lg font-semibold">Admin actions</h2>
            {ticket.ticketStatus === "active" ? (
              <button onClick={() => void updateStatus("cancelled")} className="rounded-lg bg-red-600 px-4 py-2 text-white">
                Cancel ticket
              </button>
            ) : (
              <button onClick={() => void updateStatus("active")} className="rounded-lg bg-green-600 px-4 py-2 text-white">
                Reactivate ticket
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
