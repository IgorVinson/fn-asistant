import type { Platform } from "../types/job.js";

export interface PlatformRequestSpec {
  platform: Platform;
  action: "apply" | "counter" | "skip" | "manual_review";
  method: "POST";
  path: string;
  contentType: "application/json" | "application/x-www-form-urlencoded";
  body: Record<string, unknown>;
  auth: {
    requiresCookies: boolean;
    requiresCsrfToken: boolean;
  };
}
