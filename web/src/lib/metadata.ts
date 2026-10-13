import { MAX_TEXT_LENGTH } from "./contracts";

export const CATEGORIES = ["Dev", "Design", "Copywriting", "QA", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];
export type JobMeta = { title: string; category: Category; description: string };

/**
 * Job details live in the JobCreated event's `metadataUri` string (max 512 bytes), not in
 * contract storage. Use this when creating a job so the feed can read it back.
 */
export function encodeMetadata(m: JobMeta): string {
  const json = JSON.stringify({ t: m.title.trim(), c: m.category, d: m.description.trim() });
  if (new TextEncoder().encode(json).length > MAX_TEXT_LENGTH) {
    throw new Error(`Title and description must fit in ${MAX_TEXT_LENGTH} bytes together.`);
  }
  return json;
}

/** Tolerant reader: plain-text metadata (e.g. from test jobs) becomes the title. */
export function parseMetadata(raw: string): JobMeta {
  try {
    const o = JSON.parse(raw);
    if (o && typeof o === "object") {
      return {
        title: String(o.t ?? "Untitled task").slice(0, 120),
        category: (CATEGORIES as readonly string[]).includes(o.c) ? (o.c as Category) : "Other",
        description: String(o.d ?? ""),
      };
    }
  } catch {}
  return { title: raw.trim().slice(0, 120) || "Untitled task", category: "Other", description: "" };
}
