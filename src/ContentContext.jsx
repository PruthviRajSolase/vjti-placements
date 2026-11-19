/*
  Phase 2 — src/ContentContext.jsx
  Fetches ALL public content in one request and shares it with every page.
  The admin panel calls refresh() after a successful save so the public
  pages update immediately.
*/
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const ContentContext = createContext(null);

export function ContentProvider({ children }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await api("/content");
      setContent(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ContentContext.Provider value={{ content, loading, error, refresh }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  const context = useContext(ContentContext);
  if (!context) throw new Error("useContent must be used inside ContentProvider");
  return context;
}
