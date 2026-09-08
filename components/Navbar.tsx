"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  CircleUserRound,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import Searchbar from "@/components/Searchbar";
import Button from "@/components/Button";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types";
import { formatPersonName } from "@/utils/formatPersonName";

type Notice = {
  _id: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt?: string;
};
const primaryByRole: Record<UserRole, { label: string; href: string }> = {
  attendee: { label: "Events", href: "/explore-events" },
  organizer: { label: "Events", href: "/organizerdashboard/events" },
  vendor: { label: "My Stalls", href: "/vendordashboard" },
  ticket_checker: { label: "Check Tickets", href: "/ticket-checker" },
  admin: { label: "", href: "/admin" },
};
const profileLinks: Record<UserRole, { label: string; href: string }[]> = {
  attendee: [
    { label: "Profile", href: "/userprofile" },
    { label: "My Tickets", href: "/userdashboard" },
    { label: "Saved Events", href: "/saved-events" },
    { label: "Settings", href: "/settings/profile" },
  ],
  organizer: [
    { label: "Organizer Dashboard", href: "/organizerdashboard" },
    { label: "Profile", href: "/userprofile" },
    { label: "Settings", href: "/settings/profile" },
    { label: "View Public Site", href: "/" },
  ],
  vendor: [
    { label: "Vendor Dashboard", href: "/vendordashboard" },
    { label: "Profile", href: "/userprofile" },
    { label: "Settings", href: "/settings/profile" },
    { label: "View Public Site", href: "/" },
  ],
  ticket_checker: [
    { label: "Ticket Checker Dashboard", href: "/ticket-checker" },
    { label: "Profile", href: "/userprofile" },
    { label: "Settings", href: "/settings/profile" },
  ],
  admin: [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Settings", href: "/settings/account" },
    { label: "View Public Site", href: "/" },
  ],
};
const searchPlaceholderByRole: Record<UserRole, string> = {
  attendee: "Search events...",
  organizer: "Search your events...",
  vendor: "Search events or stalls...",
  ticket_checker: "Search tickets or attendees...",
  admin: "Search users, events, tickets...",
};

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false),
    [noticesOpen, setNoticesOpen] = useState(false),
    [profileOpen, setProfileOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const authenticated = status === "authenticated" && Boolean(session?.user);
  const role = authenticated
    ? (session?.user?.role as UserRole | undefined)
    : undefined;
  const primary = role ? primaryByRole[role] : undefined;
  const isAdmin = role === "admin" && pathname.startsWith("/admin");
  const visiblePrimary =
    role === "admin" && !isAdmin ? primaryByRole.attendee : primary;
  const displayName = session?.user?.name ?? "Guest";
  const image = session?.user?.image as string | undefined;
  useEffect(() => {
    if (!authenticated) return;
    fetch("/api/notifications?pageSize=5", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          setNotices(result.data.items ?? []);
          setUnread(result.data.unreadCount ?? 0);
        }
      })
      .catch(() => undefined);
  }, [authenticated, noticesOpen]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (
        headerRef.current &&
        !headerRef.current.contains(event.target as Node)
      ) {
        setNoticesOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  if (pathname === "/login" || pathname === "/signup") return null;
  const logout = async () => {
    await signOut({ callbackUrl: "/" });
  };
  return (
    <header
      ref={headerRef}
      className={cn(
        "fixed inset-x-0 top-0 z-50 h-[72px] border-b border-border bg-surface/95 text-text-dark shadow-sm backdrop-blur-md",
        isAdmin && "lg:left-64",
      )}
    >
      <div className="navbar-content">
        {!isAdmin && (
          <Link
            href={role === "attendee" ? "/" : (primary?.href ?? "/")}
            className="shrink-0"
          >
            <div className="relative h-[56px] w-[112px]">
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
        )}
        {visiblePrimary && (
          <Link
            href={visiblePrimary.href}
            className="hidden px-3 py-2 text-sm font-semibold sm:block"
          >
            {visiblePrimary.label}
          </Link>
        )}
        <div className="hidden min-w-0 flex-1 md:block">
          <Suspense
            fallback={
              <div className="h-12 rounded-full border border-border" />
            }
          >
            <Searchbar
              compact
              showLocation={false}
              placeholder={
                role ? searchPlaceholderByRole[role] : "Search events..."
              }
            />
          </Suspense>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {authenticated ? (
            <>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNoticesOpen((value) => !value)}
                  className="relative rounded-full p-2"
                  aria-label="Notifications"
                >
                  <Bell size={20} />
                  {unread > 0 && (
                    <span className="absolute right-0 top-0 rounded-full bg-primary px-1 text-[10px] text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </button>
                {noticesOpen && (
                  <div className="absolute right-0 top-12 w-80 rounded-2xl border border-border bg-surface shadow-xl">
                    <div className="max-h-80 overflow-y-auto">
                      {notices.length ? (
                        notices.map((notice) => (
                          <Link
                            key={notice._id}
                            href={notice.link ?? "/notification"}
                            onClick={() => setNoticesOpen(false)}
                            className="block border-b border-divider px-4 py-3 hover:bg-primary-light"
                          >
                            <p className="text-sm font-semibold">
                              {notice.title}
                            </p>
                            <p className="text-sm text-text-light">
                              {notice.message}
                            </p>
                          </Link>
                        ))
                      ) : (
                        <p className="p-5 text-center text-sm text-text-light">
                          You are all caught up.
                        </p>
                      )}
                    </div>
                    <Link
                      href="/notification"
                      className="block p-3 text-center text-sm text-primary"
                    >
                      View all notifications
                    </Link>
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((value) => !value)}
                  className="flex items-center gap-1 rounded-full p-1.5"
                  aria-label="Open profile menu"
                >
                  <span className="relative block h-8 w-8 overflow-hidden rounded-full border border-border bg-surface-hover">
                    {image ? (
                      <Image
                        src={image}
                        alt={displayName}
                        width={32}
                        height={32}
                        unoptimized
                        className="h-full w-full object-cover object-center"
                      />
                    ) : (
                      <CircleUserRound
                        size={30}
                        className="h-full w-full p-0.5 text-text-light"
                      />
                    )}
                  </span>
                  <ChevronDown size={16} />
                </button>
                {profileOpen && role && (
                  <div className="absolute right-0 top-12 w-72 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
                    <div className="border-b border-divider px-4 py-4">
                      <p className="font-semibold">{formatPersonName(displayName)}</p>
                      <p className="text-xs capitalize text-primary">
                        {role.replace("_", " ")}
                      </p>
                    </div>
                    {profileLinks[role].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setProfileOpen(false)}
                        className="block px-4 py-3 text-sm hover:bg-primary-light"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <button
                      type="button"
                      onClick={() => void logout()}
                      className="flex w-full gap-2 border-t border-divider px-4 py-3 text-left text-sm text-error"
                    >
                      <LogOut size={16} />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="hidden gap-2 sm:flex">
              <Link href="/login">
                <Button text="Log In" variant="secondary" size="sm" />
              </Link>
              <Link href="/signup">
                <Button text="Sign Up" variant="cta" size="sm" />
              </Link>
            </div>
          )}
          {!isAdmin && (
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className="rounded-lg p-2 sm:hidden"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          )}
        </div>
      </div>
      {mobileOpen && !isAdmin && (
        <div className="border-t border-border bg-surface p-4 sm:hidden">
          {visiblePrimary && (
            <Link
              href={visiblePrimary.href}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-3 font-semibold text-primary"
            >
              {visiblePrimary.label}
            </Link>
          )}
          <Link href="/notification" className="block px-3 py-3">
            Notifications
          </Link>
        </div>
      )}
    </header>
  );
}
