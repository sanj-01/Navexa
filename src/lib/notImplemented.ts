// Shared 501 helper for the six stubbed route handlers. Each handler returns
// the correct response shape (per src/types/api.ts) with default/empty fields
// so the frontend can start building against the contract before the real
// implementation lands.

import { NextResponse } from "next/server";
import { envelope } from "@/lib/env";

export function notImplemented<T extends object>(payload: T, endpoint: string): NextResponse {
  return NextResponse.json(
    {
      ...envelope(),
      ...payload,
      error: `${endpoint} not implemented`,
      code: "NOT_IMPLEMENTED",
    },
    { status: 501 }
  );
}
