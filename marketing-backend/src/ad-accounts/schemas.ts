import { z } from "zod";

export const ConnectAccountSchema = z.object({
  organizationId: z.string().min(1),
  platform:       z.enum(["meta", "google", "tiktok"]),
  accessToken:    z.string().min(1),
  externalId:     z.string().min(1),
});

export type ConnectAccountInput = z.infer<typeof ConnectAccountSchema>;
