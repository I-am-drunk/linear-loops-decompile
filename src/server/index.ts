/**
 * Composition root: store + http + the WS channel, one call to boot.
 * RPC methods beyond env.describe land in their own slices (R3.3 settings,
 * R4.x loops, R6.x runs); this slice proves the boot path.
 */

import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { attachWs } from "../connect/server.ts";
import { Store } from "./store.ts";
import { createHttpServer } from "./http.ts";
import { createSettingsHandlers } from "./settings-rpc.ts";

export interface EnvironmentDescriptor {
  id: string;
  label: string;
  platform: string;
  capabilities: string[];
  protocol: 1;
  product: "loops-server";
  version: string;
}

export interface LoopsServer {
  http: Server;
  store: Store;
  token: string;
  port: () => number;
  close: () => Promise<void>;
}

export interface BootOptions {
  dbPath: string;
  staticDir?: string;
  label?: string;
  /** Reuse an explicit token (tests); otherwise persisted/generated. */
  token?: string;
  /** Inject a fake fetch in tests (probes never hit the network there). */
  fetchImpl?: typeof fetch;
}

export function createLoopsServer(opts: BootOptions): LoopsServer {
  const store = new Store(opts.dbPath);

  let token = opts.token ?? store.getSetting("sessionToken");
  if (!token) {
    token = `loops_${randomUUID()}${randomUUID()}`.replaceAll("-", "");
    store.setSetting("sessionToken", token);
  }

  const descriptor: EnvironmentDescriptor = {
    id: store.getSetting("envId") ?? (() => {
      const id = randomUUID();
      store.setSetting("envId", id);
      return id;
    })(),
    label: opts.label ?? "loops-server",
    platform: process.platform,
    capabilities: ["loops", "runs", "settings"],
    protocol: 1,
    product: "loops-server",
    version: "0.1.0",
  };

  const http = createHttpServer({ staticDir: opts.staticDir, descriptor: () => descriptor });
  attachWs(http, {
    authorize: (t) => (t === token ? { token: t } : null),
    registry: {
      "env.describe": () => descriptor,
      ...createSettingsHandlers(store, opts.fetchImpl),
    },
  });

  store.audit("server.boot", { label: descriptor.label });

  return {
    http,
    store,
    token,
    port: () => (http.address() as AddressInfo).port,
    close: () =>
      new Promise<void>((resolve) => {
        store.close();
        http.close(() => resolve());
      }),
  };
}
