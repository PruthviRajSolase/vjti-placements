/*
  Phase 8 — NotificationsPage.jsx
  A private inbox for review decisions and new submissions. Every row already
  belongs to the signed-in user on the server; this page just renders the
  cached list from NotificationsContext and offers mark-as-read actions.
*/
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useNotifications } from "../NotificationsContext.jsx";

function formatWhen(value) {
  if (!value) return "";
  const date = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return value;
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return date.toLocaleDateString();
}

function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Refresh on entry so a notification created in another tab shows up.
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function act(action) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err.message || "Could not update notifications.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="list-page notifications-page">
      <div className="page-intro">
        <h1 className="page-title">Notifications</h1>
        <p className="section-sub">
          Review decisions on your write-ups and new submissions waiting for
          staff. Only you can see these messages.
        </p>
      </div>

      {error && <p className="admin-message error" role="alert">{error}</p>}

      <div className="notification-toolbar">
        <span>
          {unreadCount === 0
            ? "You're all caught up."
            : `${unreadCount} unread ${unreadCount === 1 ? "message" : "messages"}.`}
        </span>
        {unreadCount > 0 && (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => act(markAllRead)}
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="empty-card">
          <h2>Nothing here yet</h2>
          <p>Updates about your experiences will appear in this inbox.</p>
          <Link className="btn-primary" to="/">Back to home →</Link>
        </div>
      ) : (
        <ul className="notification-list">
          {notifications.map((item) => (
            <li
              className={`notification-item${item.readAt ? "" : " unread"}`}
              key={item.id}
              data-testid="notification-item"
            >
              <span className="notification-dot" aria-hidden="true" />
              <div className="notification-content">
                <div className="notification-head">
                  <strong>{item.title}</strong>
                  <time dateTime={item.createdAt}>{formatWhen(item.createdAt)}</time>
                </div>
                {item.body && <p>{item.body}</p>}
                <div className="notification-actions">
                  {item.link && (
                    <Link to={item.link} onClick={() => !item.readAt && act(() => markRead(item.id))}>
                      Open →
                    </Link>
                  )}
                  {!item.readAt && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act(() => markRead(item.id))}
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default NotificationsPage;
