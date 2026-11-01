import { z } from "zod";
import {Filter} from "bad-words";

const filter = new Filter();

export const createPostSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Post content is required")
    .max(1000, "Post cannot exceed 1000 characters")
    .refine((content) => !filter.isProfane(content), {
      message: "Your post contains inappropriate language",
    }),
});