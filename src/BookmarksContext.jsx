/*
  Phase 6 — BookmarksContext.jsx
  Shared saved-company state for signed-in users. The server is the source of
  truth (GET /api/bookmarks returns only this user's rows); this context just
  caches the list so a Save click updates every card and the Saved page at
  once. Signing out clears it, signing in reloads it.
*/
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api.js";
import { useAuth } from "./AuthContext.jsx";

const BookmarksContext = createContext(null);

export function BookmarksProvider({ children }) {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState([]);

  const refresh = useCallback(async () => {
    if (!user) {
      setBookmarks([]);
      return;
    }
    try {
      const data = await api("/bookmarks");
      setBookmarks(data.bookmarks);
    } catch {
      setBookmarks([]);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isSaved = useCallback(
    (slug) => bookmarks.some((bookmark) => bookmark.slug === slug),
    [bookmarks]
  );

  async function toggle(slug) {
    if (isSaved(slug)) {
      await api(`/bookmarks/${encodeURIComponent(slug)}`, { method: "DELETE" });
    } else {
      await api("/bookmarks", { method: "POST", body: { slug } });
    }
    await refresh();
  }

  return (
    <BookmarksContext.Provider value={{ bookmarks, isSaved, toggle, refresh }}>
      {children}
    </BookmarksContext.Provider>
  );
}

export function useBookmarks() {
  const context = useContext(BookmarksContext);
  if (!context) {
    throw new Error("useBookmarks must be used inside BookmarksProvider");
  }
  return context;
}
