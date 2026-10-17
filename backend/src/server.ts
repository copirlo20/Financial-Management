import "./env";
import { createApp } from "./app";
import { startMaintenance } from "./maintenance";

// The API server. Only the frontend's server side calls it (see frontend/lib/api), never the browser,
// so it listens on localhost unless HOST says otherwise.
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "127.0.0.1";

createApp().listen(port, host, () => {
  console.log(`Backend listening on http://${host}:${port}`);
});
startMaintenance();
