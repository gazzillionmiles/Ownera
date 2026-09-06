import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  TEST_ACCESS_PASSWORD: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  RATE_LIMIT: z.coerce.number().default(20),
  APP_COOKIE_PREFIX: z.string().default('ownera'),
  APP_NAME: z.string().default('Ownera'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_USER_ID: z.string().optional(),
});

export const env = envSchema.parse(process.env);
