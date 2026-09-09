"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  CalendarDays,
  LayoutDashboard,
  Settings,
  Store,
  Ticket,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Counts = {
  pendingEvents: number;
  pendingVendors: number;
  pendingStalls: number;
};
const items = [
  {
    section: "Overview",
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  { section: "Management", label: "Users", href: "/admin/users", icon: Users },
  {
    section: "Management",
    label: "Events",
    href: "/admin/events",
    icon: CalendarDays,
    count: "pendingEvents" as const,
  },
  {
    section: "Management",
    label: "Vendors",
    href: "/admin/vendors",
    icon: Store,
    count: "pendingVendors" as const,
  },
  {
    section: "Management",
    label: "Approvals",
    href: "/admin/approvals#stalls",
    icon: Store,
    count: "pendingStalls" as const,
  },
  {
    section: "Management",
    label: "Tickets",
    href: "/admin/tickets",
    icon: Ticket,
  },
  {
    section: "System",
    label: "Notifications",
    href: "/admin/notifications",
    icon: Bell,
  },
  {
    section: "System",
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [counts, setCounts] = useState<Counts>({
    pendingEvents: 0,
    pendingVendors: 0,
    pendingStalls: 0,
  });
  useEffect(() => {
    fetch("/api/admin/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((result) => {
        if (result.success) setCounts(result.data.summary);
      })
      .catch(() => undefined);
  }, []);
  return (
    <aside className="fixed inset-y-0 left-0 z-60 hidden h-dvh w-64 overflow-hidden border-r border-border bg-surface lg:flex lg:flex-col">
      <Link
        href="/admin"
        className="flex h-[72px] shrink-0 items-center border-b border-border px-6"
      >
        <div className="relative h-12 w-28">
          <Image
            src="/VivntLogo.png"
            alt="Vivnt"
            fill
            sizes="112px"
            className="scale-[1.35] object-contain"
            priority
          />
        </div>
      </Link>
      <nav className="flex-1 overflow-hidden px-3 py-5">
        {["Overview", "Management", "System"].map((section) => (
          <div key={section} className="mb-6">
            <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-text-muted">
              {section}
            </p>
            {items
              .filter((item) => item.section === section)
              .map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href.split("#")[0]);
                const count = item.count ? counts[item.count] : 0;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                      "mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary-light text-primary"
                        : "text-text-dark hover:bg-primary-light hover:text-primary",
                    )}
                  >
                    <Icon size={18} />
                    <span className="flex-1">{item.label}</span>
                    {item.count && count > 0 && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">
                        {count}
                      </span>
                    )}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
