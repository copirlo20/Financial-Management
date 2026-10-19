import { networkInterfaces } from "node:os";

// This machine's IPv4 addresses that another device on the same network can reach. Virtual adapters
// (VMware, Hyper-V, WSL, VPNs) and link-local addresses are left out: no phone can open them.
const VIRTUAL_ADAPTER = /vmware|virtualbox|vethernet|hyper-v|wsl|docker|loopback|tailscale|zerotier/i;

export function lanAddresses() {
  return Object.entries(networkInterfaces())
    .filter(([name]) => !VIRTUAL_ADAPTER.test(name))
    .flatMap(([, list]) => list ?? [])
    .filter((address) => address.family === "IPv4" && !address.internal && !address.address.startsWith("169.254."))
    .map((address) => address.address);
}
