"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const statuses = ["pending", "approved", "rejected"] as const;
type Vendor = {
  _id: string;
  businessName: string;
  category: string;
  approvalStatus: (typeof statuses)[number];
  owner?: { name?: string; email?: string };
};

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ pageSize: "50" });
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    try {
      const response = await fetch(`/api/admin/vendors?${params}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? "Unable to load vendors.");
      setVendors(result.data.items ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load vendors.");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => { void loadVendors(); }, [loadVendors]);

  const updateVendor = async (id: string, approvalStatus: "approved" | "rejected") => {
    setSavingId(id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/vendors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? "Unable to update vendor.");
      setVendors((current) => current.map((vendor) => vendor._id === id ? { ...vendor, approvalStatus } : vendor));
      setMessage("Vendor status updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update vendor.");
    } finally {
      setSavingId("");
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 font-cause text-text-dark">
      <h1 className="mb-2 font-dynapuff text-3xl font-semibold">Manage Vendors</h1>
      <p className="mb-6 text-text-light">Review vendor accounts, check their status, and open full vendor details.</p>
      <div className="mb-5 grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-3">
        <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void loadVendors()} placeholder="Search vendors" className="rounded-lg border border-border px-3 py-2" />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-border px-3 py-2">
          <option value="">All statuses</option>
          {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button onClick={() => void loadVendors()} className="rounded-lg bg-primary px-4 py-2 font-medium text-white">Apply filters</button>
      </div>
      {message && <p className="mb-4 text-green-700">{message}</p>}
      {error && <p className="mb-4 text-error">{error}</p>}
      {loading ? <p>Loading vendors...</p> : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[850px] text-left">
            <thead><tr className="border-b border-divider text-sm text-text-light"><th className="p-3">Vendor</th><th className="p-3">Owner</th><th className="p-3">Category</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
            <tbody>
              {vendors.length === 0 ? <tr><td colSpan={5} className="p-5 text-text-light">No vendors found.</td></tr> : vendors.map((vendor) => (
                <tr key={vendor._id} className="border-b border-divider last:border-0">
                  <td className="p-3 font-medium">{vendor.businessName}</td>
                  <td className="p-3">{vendor.owner?.name ?? "Unknown"}<br /><span className="text-sm text-text-light">{vendor.owner?.email ?? "-"}</span></td>
                  <td className="p-3">{vendor.category}</td>
                  <td className="p-3"><span className="rounded-full bg-primary-light px-3 py-1 text-sm capitalize text-primary">{vendor.approvalStatus}</span></td>
                  <td className="p-3"><div className="flex gap-2">
                    {vendor.approvalStatus !== "approved" && <button disabled={savingId === vendor._id} onClick={() => void updateVendor(vendor._id, "approved")} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white">Approve</button>}
                    {vendor.approvalStatus !== "rejected" && <button disabled={savingId === vendor._id} onClick={() => void updateVendor(vendor._id, "rejected")} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white">Reject</button>}
                    <Link href={`/admin/vendors/${vendor._id}`} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-hover">View Details</Link>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
