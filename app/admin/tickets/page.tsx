"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Ticket = {
  _id: string;
  ticketNumber: string;
  ticketType: string;
  paymentStatus: string;
  ticketStatus: string;
  checkedIn: boolean;
  purchaseDate: string;
  user?: { name?: string; email?: string };
  event?: { title?: string; organizer?: { name?: string } };
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: "100" });
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    try {
      const response = await fetch(`/api/admin/tickets?${params}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? "Unable to load tickets.");
      setTickets(result.data.items ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load tickets.");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 font-cause text-text-dark">
      <h1 className="mb-2 font-dynapuff text-3xl font-semibold">Manage Tickets</h1>
      <p className="mb-6 text-text-light">Review ticket status, attendees, payments, and check-in information.</p>

      <div className="mb-5 grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void load()}
          placeholder="Search ticket number"
          className="rounded-lg border border-border px-3 py-2"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-lg border border-border px-3 py-2"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          onClick={() => void load()}
          className="rounded-lg bg-primary px-4 py-2 font-medium text-white"
        >
          Apply filters
        </button>
      </div>

      {error && <p className="mb-4 text-error">{error}</p>}

      {loading ? (
        <p>Loading tickets...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[1000px] text-left">
            <thead>
              <tr className="border-b border-divider text-sm text-text-light">
                <th className="p-3">Ticket</th>
                <th className="p-3">Attendee</th>
                <th className="p-3">Event</th>
                <th className="p-3">Organizer</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length ? (
                tickets.map((ticket) => (
                  <tr key={ticket._id} className="border-b border-divider last:border-0">
                    <td className="p-3 font-medium">
                      {ticket.ticketNumber}
                      <br />
                      <span className="text-sm text-text-light">{ticket.ticketType}</span>
                    </td>
                    <td className="p-3">
                      {ticket.user?.name ?? "-"}
                      <br />
                      <span className="text-sm text-text-light">{ticket.user?.email ?? "-"}</span>
                    </td>
                    <td className="p-3">{ticket.event?.title ?? "-"}</td>
                    <td className="p-3">{ticket.event?.organizer?.name ?? "-"}</td>
                    <td className="p-3 capitalize">{ticket.paymentStatus}</td>
                    <td className="p-3 capitalize">
                      {ticket.ticketStatus}
                      {ticket.checkedIn && <span className="ml-2 text-green-700">Checked in</span>}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/admin/tickets/${ticket._id}`}
                        className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-hover"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-5 text-text-light">
                    No tickets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
