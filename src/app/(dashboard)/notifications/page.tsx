"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, truncate } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchNotifications = useCallback(async (pageNum = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(pageNum * limit),
    });
    const res = await fetch(`/api/notifications?${params}`);
    const data = await res.json();
    setNotifications(data.notifications || []);
    setTotal(data.total || 0);
    setUnreadCount(data.unreadCount || 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifications(page);
  }, [page, fetchNotifications]);

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

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2">
            <CheckCheck className="h-4 w-4" /> Mark All Read
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Notifications ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Title</th>
                    <th className="pb-3 font-medium">Message</th>
                    <th className="pb-3 font-medium">Time</th>
                    <th className="pb-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((n) => (
                    <tr
                      key={n.id}
                      className={`border-b last:border-0 ${
                        !n.read ? "bg-muted/30" : ""
                      }`}
                    >
                      <td className="py-3 pr-4">
                        <Badge
                          variant={
                            n.type.includes("phishing") || n.type.includes("delete")
                              ? "danger"
                              : n.type.includes("suspicious") ||
                                  n.type.includes("suspend")
                                ? "warning"
                                : "secondary"
                          }
                        >
                          {n.type.split(".")[1] || n.type}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 font-medium">{n.title}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {truncate(n.message, 60)}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {formatRelativeTime(new Date(n.createdAt))}
                      </td>
                      <td className="py-3">
                        {!n.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => markRead([n.id])}
                            title="Mark as read"
                          >
                            <CheckCheck className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {notifications.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-12 text-center text-muted-foreground"
                      >
                        <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
                        <p>No notifications yet</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
