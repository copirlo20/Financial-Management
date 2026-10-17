import "./env";
import { createApp } from "./app";
import { startMaintenance } from "./maintenance";

// The API server. Only the frontend's server side calls it (see frontend/lib/api), never the browser,
// so it listens on localhost unless HOST says otherwise.
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "127.0.0.1";

const server = createApp().listen(port, host, () => {
  console.log(`Backend listening on http://${host}:${port}`);
});
// The frontend keeps its connections to the backend open and reuses them. Node closes an idle one after
// 5 s by default, and a request sent on a connection at the very moment it closes fails with
// "read ECONNRESET". Keeping idle connections longer than the client does removes that race.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
startMaintenance();
