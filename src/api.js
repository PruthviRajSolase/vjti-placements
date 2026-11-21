/*
  Phase 2 — src/api.js
  One tiny wrapper around fetch. All requests go to the Vite-proxied /api
  path, so the browser sees one origin and the httpOnly session cookie is
  sent automatically (credentials: "same-origin").
*/
export async function api(path, options = {}) {
  const { body, headers, ...rest } = options;

  const response = await fetch(`/api${path}`, {
    ...rest,
    credentials: "same-origin",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    // Endpoints like the CSV import return per-row validation messages in
    // `details`; keep them on the error so forms can show all problems.
    error.details = data.details;
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
