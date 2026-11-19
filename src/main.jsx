/*
  Phase 2 — src/main.jsx
  BrowserRouter gives us routing. AuthProvider, BookmarksProvider,
  ContentProvider and NotificationsProvider wrap the app so every page can
  read the real session, the user's private shortlist, the public API content
  and their own in-app notifications.
*/
import { StrictMode } from "react";
import { BrowserRouter } from "react-router-dom";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { AuthProvider } from "./AuthContext.jsx";
import { BookmarksProvider } from "./BookmarksContext.jsx";
import { ContentProvider } from "./ContentContext.jsx";
import { NotificationsProvider } from "./NotificationsContext.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <BookmarksProvider>
            <ContentProvider>
              <NotificationsProvider>
                <App />
              </NotificationsProvider>
            </ContentProvider>
          </BookmarksProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
