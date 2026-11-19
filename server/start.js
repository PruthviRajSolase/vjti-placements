/*
  Production entry point: `npm start`.

  Sets NODE_ENV before loading the API so Express also serves dist/ (the
  built React app) with an SPA fallback. Keeping this in a tiny file avoids
  platform-specific `set`/`export` syntax in package.json scripts.
*/
process.env.NODE_ENV = "production";
await import("./index.js");
