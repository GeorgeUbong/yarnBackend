import { z } from 'zod';

export const updateUsernameSchema = z.object({
  username: z.string().trim().min(2, 'Name must be at least 2 characters'),
});
