import { z } from "zod";

const nameSchema = z.string().trim().min(1).max(100);

const urlSchema = z.url().refine((value) => {
  const parsed = new URL(value);

  return(["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password);
}, "URL must use HTTP or HTTPS and must not contain credentials");

const methodSchema = z.enum(["GET", "HEAD"]);
const intervalSecondsSchema = z.number().int().min(10).max(86400);
const timeoutMsSchema = z.number().int().min(1000).max(30000);
const expectedStatusSchema = z.number().int().min(100).max(599);
const latencyThresholdMsSchema = z.number().int().min(1).max(30000);
const enabledSchema = z.boolean();

export const createMonitorSchema = z.object({
  name: nameSchema,
  url: urlSchema,
  method: methodSchema.default("GET"),
  intervalSeconds: intervalSecondsSchema.default(60),
  timeoutMs: timeoutMsSchema.default(5000),
  expectedStatus: expectedStatusSchema.default(200),
  latencyThresholdMs: latencyThresholdMsSchema.default(1000),
  enabled: enabledSchema.default(true)
}).strict();

export const updateMonitorSchema = z.object({
  name: nameSchema,
  url: urlSchema,
  method: methodSchema,
  intervalSeconds: intervalSecondsSchema,
  timeoutMs: timeoutMsSchema,
  expectedStatus: expectedStatusSchema,
  latencyThresholdMs: latencyThresholdMsSchema,
  enabled: enabledSchema
}).partial().strict();

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;
export type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>;
