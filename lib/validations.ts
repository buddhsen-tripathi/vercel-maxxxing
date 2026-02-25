import { z } from "zod";

export const reviewInputSchema = z
  .object({
    code: z.string().optional(),
    commitUrl: z.string().url().optional(),
    conversationId: z.string().optional(),
  })
  .refine((d) => d.code?.trim() || d.commitUrl?.trim(), {
    message: "Either code or commitUrl is required",
  });

export const chatInputSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      })
    )
    .min(1, "At least one message is required"),
  conversationId: z.string().min(1, "conversationId is required"),
});

export const standaloneChatInputSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["user", "assistant", "system"]),
      parts: z.array(z.any()),
    })
  ).min(1, "At least one message is required"),
});
