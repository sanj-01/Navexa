// Offline fallback (DEMO_OFFLINE=1) — ANVIL-SPEC.md §12 H+26–H+30, Prompt 8.
// Reads canned responses from data/demo-cache/<endpoint>/<key>.json.
// Falls back silently to null if no cache entry exists.

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export async function loadDemoCache(endpoint: string, key: string): Promise<Record<string, unknown> | null> {
  const hash = crypto.createHash("sha256").update(key.toLowerCase().trim()).digest("hex").slice(0, 16);
  const file = path.join(process.cwd(), "data", "demo-cache", endpoint, `${hash}.json`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}
