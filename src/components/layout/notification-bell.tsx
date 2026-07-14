"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelativeTime, truncate } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unread=true&limit=5");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (ids: string[]) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - ids.length));
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => {
          setOpen(!open);
          if (!open) fetchUnread();
        }}
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button
                className="text-xs text-emerald-500 hover:underline"
                onClick={async () => {
                  await fetch("/api/notifications", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ all: true }),
                  });
                  setNotifications([]);
                  setUnreadCount(0);
                }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No new notifications
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`border-b px-4 py-3 last:border-0 ${
                    !n.read ? "bg-muted/50" : ""
                  }`}
                  onClick={() => {
                    if (!n.read) markRead([n.id]);
                    setOpen(false);
                  }}
                >
                  <Link href={n.link || "#"} className="block">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {truncate(n.message, 80)}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/60">
                      {formatRelativeTime(new Date(n.createdAt))}
                    </p>
                  </Link>
                </div>
              ))
            )}
          </div>
          <Link
            href="/notifications"
            className="block border-t px-4 py-2 text-center text-xs text-emerald-500 hover:underline"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
