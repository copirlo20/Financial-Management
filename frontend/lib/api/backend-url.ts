// Where the backend listens (npm run dev and npm start set BACKEND_URL to match BACKEND_PORT), without a
// trailing slash. Kept free of Next.js imports: proxy.ts uses it too.
export const BACKEND_URL = (process.env.BACKEND_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
