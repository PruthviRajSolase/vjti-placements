/*
  Phase 6 — BookmarkButton.jsx
  One toggle used on company cards, the company detail page and the Saved
  list. Signed-out visitors get a sign-in link instead of a dead control.
  `floating` pins the button to the corner of a company tile.
*/
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { useBookmarks } from "../BookmarksContext.jsx";

function BookmarkButton({ slug, floating = false }) {
  const { user } = useAuth();
  const { isSaved, toggle } = useBookmarks();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();

  const classes = `bookmark-btn${floating ? " floating" : ""}`;

  if (!user) {
    return (
      <Link
        className={classes}
        to="/signin"
        state={{ from: location.pathname + location.search }}
        title="Sign in to save companies"
        onClick={(event) => {
          if (floating) event.stopPropagation();
        }}
      >
        <span aria-hidden="true">☆</span> <span>Save</span>
      </Link>
    );
  }

  const saved = isSaved(slug);

  async function handleClick(event) {
    // Company cards are links; don't let a Save click navigate away.
    event.preventDefault();
    event.stopPropagation();
    setBusy(true);
    setError("");
    try {
      await toggle(slug);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`${classes}${saved ? " saved" : ""}`}
      onClick={handleClick}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved companies" : "Save company"}
      title={error || (saved ? "Saved — click to remove" : "Save this company")}
    >
      <span aria-hidden="true">{saved ? "★" : "☆"}</span>{" "}
      <span>{busy ? "…" : saved ? "Saved" : "Save"}</span>
    </button>
  );
}

export default BookmarkButton;
