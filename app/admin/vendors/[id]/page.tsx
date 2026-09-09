"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

 type Vendor = {
  _id: string;
  businessName: string;
  description: string;
  category: string;
  approvalStatus: string;
  owner?: { name?: string; email?: string; phone?: string; location?: string };
  stallBookings?: Array<{ stallName: string; stallType: string; size: string; bookingFee: number; status: string; bookedAt: string; event?: { title?: string; venue?: string; startDate?: string } }>;
};

export default function AdminVendorDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/vendors/${id}`, { cache: "no-store" }).then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? "Unable to load vendor.");
      setVendor(result.data);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load vendor.")).finally(() => setLoading(false));
  }, [id]);
  const updateStatus = async (approvalStatus: "approved" | "rejected") => {
    const response = await fetch(`/api/admin/vendors/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approvalStatus }) });
    const result = await response.json();
    if (!response.ok || !result.success) { setError(result.error?.message ?? "Unable to update vendor."); return; }
    setVendor((current) => current ? { ...current, approvalStatus } : current);
    setMessage("Vendor status updated.");
  };
  if (loading) return <section className="mx-auto max-w-5xl px-4 py-12">Loading vendor...</section>;
  if (error || !vendor) return <section className="mx-auto max-w-5xl px-4 py-12 text-error">{error || "Vendor not found."}</section>;
  return <section className="mx-auto max-w-5xl px-4 py-12 font-cause text-text-dark">
    <Link href="/admin/vendors" className="text-sm font-semibold text-primary hover:underline">← Back to vendors</Link>
    <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="font-dynapuff text-3xl font-semibold">{vendor.businessName}</h1><p className="mt-1 text-text-light">{vendor.category}</p></div>
      <span className="rounded-full bg-primary-light px-3 py-1 text-sm capitalize text-primary">{vendor.approvalStatus}</span>
    </div>
    {message && <p className="mt-4 text-green-700">{message}</p>}
    <div className="mt-8 grid gap-5 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-surface p-5"><h2 className="mb-3 text-lg font-semibold">Vendor information</h2><p className="text-text-light">{vendor.description}</p><div className="mt-4 space-y-2 text-sm"><p><strong>Owner:</strong> {vendor.owner?.name ?? "-"}</p><p><strong>Email:</strong> {vendor.owner?.email ?? "-"}</p><p><strong>Phone:</strong> {vendor.owner?.phone ?? "-"}</p><p><strong>Location:</strong> {vendor.owner?.location ?? "-"}</p></div></div>
      <div className="rounded-xl border border-border bg-surface p-5"><h2 className="mb-3 text-lg font-semibold">Admin actions</h2><div className="flex flex-wrap gap-2">{vendor.approvalStatus !== "approved" && <button onClick={() => void updateStatus("approved")} className="rounded-lg bg-green-600 px-4 py-2 text-white">Approve vendor</button>}{vendor.approvalStatus !== "rejected" && <button onClick={() => void updateStatus("rejected")} className="rounded-lg bg-red-600 px-4 py-2 text-white">Reject vendor</button>}</div></div>
    </div>
    <div className="mt-6 rounded-xl border border-border bg-surface p-5"><h2 className="mb-3 text-lg font-semibold">Stall requests</h2>{vendor.stallBookings?.length ? <div className="space-y-3">{vendor.stallBookings.map((booking, index) => <div key={`${booking.stallName}-${index}`} className="rounded-lg border border-divider p-3"><div className="flex justify-between gap-3"><p className="font-medium">{booking.stallName}</p><span className="capitalize text-text-light">{booking.status}</span></div><p className="text-sm text-text-light">{booking.event?.title ?? "Event"} · {booking.stallType} · {booking.size}</p></div>)}</div> : <p className="text-text-light">No stall requests found.</p>}</div>
  </section>;
}
