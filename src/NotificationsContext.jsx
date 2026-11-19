/*
  Phase 8 — NotificationsContext.jsx
  Shared in-app notification state. The API is the source of truth: every
  query is scoped to the signed-in user on the server, so this context only
  caches the list and the unread count for the header bell and /notifications.
  It reloads on sign-in and when the browser tab regains focus.
*/
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api.js";
import { useAuth } from "./AuthContext.jsx";

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const data = await api("/notifications");
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Keep the badge fresh when the user comes back to the tab (e.g. after a
  // TPO reviews a submission in another window).
  useEffect(() => {
    if (!userId) return undefined;
    const onFocus = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [refresh, userId]);

  async function markRead(id) {
    await api(`/notifications/${id}/read`, { method: "POST" });
    await refresh();
  }

  async function markAllRead() {
    await api("/notifications/read-all", { method: "POST" });
    await refresh();
  }

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, refresh, markRead, markAllRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used inside NotificationsProvider");
  }
  return context;
}
