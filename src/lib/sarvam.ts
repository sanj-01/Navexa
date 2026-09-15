// Thin fetch client for Sarvam ASR. Tamil audio in → transcript out.
// The full endpoint URL is kept here so it can be swapped without touching
// callers.

import { requireEnv } from "./env";

const SARVAM_ASR_URL = "https://api.sarvam.ai/speech-to-text";

export interface SarvamAsrResponse {
  transcript: string;
  language_code: string;
  request_id?: string;
}

export interface SarvamAsrOptions {
  language?: "ta-IN" | "hi-IN" | "en-IN";
  model?: string;
}

export async function sarvamTranscribe(
  audio: Blob,
  opts: SarvamAsrOptions = {},
  signal?: AbortSignal
): Promise<SarvamAsrResponse> {
  const key = requireEnv("SARVAM_API_KEY");

  const form = new FormData();
  form.set("file", audio, "input.wav");
  form.set("language_code", opts.language ?? "ta-IN");
  if (opts.model) form.set("model", opts.model);

  const res = await fetch(SARVAM_ASR_URL, {
    method: "POST",
    headers: {
      "api-subscription-key": key,
    },
    body: form,
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sarvam ASR ${res.status}: ${body.slice(0, 500)}`);
  }
  return (await res.json()) as SarvamAsrResponse;
}
