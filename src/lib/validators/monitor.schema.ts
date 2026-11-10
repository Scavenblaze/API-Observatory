import { z } from "zod";

export const createMonitorSchema = z.object({
    name: z.string().trim().min(1).max(100),

    url: z.url().refine((value) => {
        try {
          const parsed = new URL(value);

          return(["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password);
        } catch {
          return false;
        }
      }, "URL must use HTTP or HTTPS and must not contain credentials"),

    method: z.enum(["GET", "HEAD"]).default("GET"),

    intervalSeconds: z.number().int().min(10).max(86400).default(60),

    timeoutMs: z.number().int().min(1000).max(30000).default(5000),

    expectedStatus: z.number().int().min(100).max(599).default(200),

    latencyThresholdMs: z.number().int().min(1).max(30000).default(1000),

    enabled: z.boolean().default(true),
  }).strict();

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;