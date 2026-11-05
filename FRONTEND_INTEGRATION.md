# Snapy Frontend Integration Guide

## Purpose

This guide is the frontend handoff for the current Snapy API. It defines the recommended feature structure, API contract, and a framework-neutral `routes.ts` API layer. The API base URL is configured through `VITE_API_BASE_URL` (or the equivalent environment variable in your frontend framework).

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

## Product scope available today

- Account registration and login
- Cookie-based authenticated session refresh
- Public feed (authentication required)
- Personal posts page
- Create, edit, delete, and search posts
- Update a profile name and upload a profile image

There is no logout endpoint, current-user/session endpoint, pagination, or single-post detail endpoint yet. Profile name and image can be updated, but there is not yet a profile-read endpoint.

## Recommended feature structure

Keep API transport, server state, and UI separate. This works with React Router + TanStack Query, Next.js, or another TypeScript frontend.

```text
src/
  app/
    router.tsx                 # Route definitions and protected-route wrapper
    providers.tsx              # Query client, auth bootstrap
  features/
    auth/
      api/routes.ts
      components/LoginForm.tsx
      components/SignupForm.tsx
      pages/LoginPage.tsx
      pages/SignupPage.tsx
    posts/
      api/routes.ts
      components/PostComposer.tsx
      components/PostCard.tsx
      components/PostEditor.tsx
      components/SearchInput.tsx
      pages/FeedPage.tsx
      pages/MyPostsPage.tsx
    profile/
      api/routes.ts
  shared/
    api/client.ts              # fetch wrapper, error normalization, refresh/retry
    api/types.ts               # API DTOs and error types
    lib/idempotency.ts
    components/
      AppShell.tsx
      EmptyState.tsx
      ErrorState.tsx
      LoadingState.tsx
```

Suggested application routes:

| Frontend URL | Access | Data / action |
| --- | --- | --- |
| `/login` | Guest | `POST /login` |
| `/signup` | Guest | `POST /signup` |
| `/feed` | Authenticated | `GET /posts`, search with `GET /search?q=` |
| `/my-posts` | Authenticated | `GET /posts/user`, create/edit/delete owned posts |

The API has no session-discovery endpoint. On protected-route entry, attempt `POST /refresh`; treat `200` as authenticated and `401` as signed out. Then load page data. Avoid doing this on every render; run it once during app bootstrap and after a protected request gets a `401`.

## Authentication model

The backend sets HttpOnly cookies named `token` (4 hours) and `refreshToken` (10 days). JavaScript cannot and should not read these cookies.

Every API request must include:

```ts
credentials: 'include'
```

For local development, use `http://localhost:5173` (the backend allows it) and API `http://localhost:3000`. In production, configure `CORS_ORIGINS` on the backend to the exact frontend origin. The authentication cookies use `SameSite=None` to support cross-site frontend/API deployments; production cookies are `Secure`, so both deployments must use HTTPS.

Although login/signup/refresh responses currently contain token strings, **do not store tokens in localStorage, sessionStorage, or app state**. Treat the cookies as the session mechanism. The returned `token` fields are unnecessary to this frontend design.

## API types and shared client

Create `src/shared/api/types.ts`:

```ts
export interface User {
  id: number;
  username: string;
  email: string;
  profileImage: string | null; // Base64 data URI, or null if not set
}

export interface Post {
  id: string;
  authorId: number;
  content: string;
  postedAt: string; // ISO date-time
}

export interface PostWithAuthor extends Post {
  author: Pick<User, 'id' | 'username'>;
}

export interface ApiMessage {
  message: string;
}

export interface ValidationError {
  errors: Record<string, string[] | undefined>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fieldErrors?: ValidationError['errors'],
  ) {
    super(message);
  }
}
```

Create `src/shared/api/client.ts`:

```ts
import { ApiError, type ValidationError } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  retryAfterRefresh?: boolean;
};

function isValidationError(value: unknown): value is ValidationError {
  return Boolean(value && typeof value === 'object' && 'errors' in value);
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, retryAfterRefresh = true, ...init } = options;
  const isFormData = body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  // One refresh-and-retry prevents loops and preserves mutation idempotency keys.
  if (response.status === 401 && retryAfterRefresh && path !== '/refresh') {
    const refresh = await fetch(`${API_BASE_URL}/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (refresh.ok) return apiRequest<T>(path, { ...options, retryAfterRefresh: false });
  }

  const payload = await readJson(response);
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'message' in payload
      ? String(payload.message)
      : 'Something went wrong. Please try again.';
    throw new ApiError(response.status, message, isValidationError(payload) ? payload.errors : undefined);
  }

  return payload as T;
}
```

## Route API modules

Create `src/features/auth/api/routes.ts`:

```ts
import { apiRequest } from '../../../shared/api/client';
import type { User } from '../../../shared/api/types';

export interface SignupInput { username: string; email: string; password: string }
export interface LoginInput { email: string; password: string }
export interface AuthResponse { message: string; user: User }

export const authRoutes = {
  signup: (input: SignupInput) =>
    apiRequest<AuthResponse>('/signup', { method: 'POST', body: input, retryAfterRefresh: false }),
  login: (input: LoginInput) =>
    apiRequest<AuthResponse>('/login', { method: 'POST', body: input, retryAfterRefresh: false }),
  refresh: () =>
    apiRequest<{ message: string }>('/refresh', { method: 'POST', retryAfterRefresh: false }),
};
```

Create `src/features/posts/api/routes.ts`:

```ts
import { apiRequest } from '../../../shared/api/client';
import type { ApiMessage, Post, PostWithAuthor } from '../../../shared/api/types';

export type PostsResponse = PostWithAuthor[] | ApiMessage;
export type SearchResponse = { message: string; count: number; posts: PostWithAuthor[] } | ApiMessage;

const idempotencyKey = () => crypto.randomUUID();

export const postRoutes = {
  getAll: () => apiRequest<PostsResponse>('/posts'),
  getMine: () => apiRequest<PostWithAuthor[]>('/posts/user'),
  search: (query: string) => apiRequest<SearchResponse>(`/search?q=${encodeURIComponent(query)}`),
  create: (content: string, key = idempotencyKey()) =>
    apiRequest<{ message: string; post: Post }>('/create', {
      method: 'POST', body: { content }, headers: { 'Idempotency-Key': key },
    }),
  update: (id: string, content: string) =>
    apiRequest<{ message: string; post: Post }>(`/${id}`, { method: 'PUT', body: { content } }),
  remove: (id: string, key = idempotencyKey()) =>
    apiRequest<ApiMessage>(`/${id}`, { method: 'DELETE', headers: { 'Idempotency-Key': key } }),
};
```

Important: generate an idempotency key once per user intent and reuse that same key only when retrying that exact mutation. Never generate a new key automatically after an uncertain network failure; doing so can create duplicates. The backend retains keys for 24 hours in memory.

Create `src/features/profile/api/routes.ts`:

```ts
import { apiRequest } from '../../../shared/api/client';
import type { User } from '../../../shared/api/types';

export const profileRoutes = {
  updateName: (username: string) =>
    apiRequest<{ message: string; user: User }>('/users/me', {
      method: 'PATCH',
      body: { username },
    }),
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return apiRequest<{ message: string; user: User }>('/users/me/profile-image', {
      method: 'POST',
      body: form,
    });
  },
};
```

Profile uploads accept JPEG, PNG, GIF, or WebP files up to 5 MiB. Do not set `Content-Type` for `FormData`; the browser must add the multipart boundary. The returned `user.profileImage` is a base64 data URI.

## Endpoint contract

| Method and path | Request | Success | Frontend handling |
| --- | --- | --- | --- |
| `POST /signup` | `username`, `email`, `password` | `201 { message, user, token, refreshToken }` | Navigate to `/feed`; ignore token strings. |
| `POST /login` | `email`, `password` | `200 { message, user, token, refreshToken }` | Navigate to `/feed`; ignore token strings. |
| `POST /refresh` | Cookie only | `200 { message, token }` | Mark session valid; do not persist returned token. |
| `GET /posts` | — | `PostWithAuthor[]` or `{ message }` | Render feed or empty state. |
| `GET /posts/user` | — | `PostWithAuthor[]` | Render personal posts; empty array is normal. |
| `GET /search?q=text` | non-empty `q` | `{ message, count, posts }` or `{ message }` | Debounce input 300–500 ms; only request non-empty queries. |
| `POST /create` | `{ content }`, `Idempotency-Key` | `201 { message, post }` | Trim/validate client-side; invalidate personal and feed queries. |
| `PUT /:id` | `{ content }` | `200 { message, post }` | Available only for owned posts; update/invalidate personal and feed queries. |
| `DELETE /:id` | `Idempotency-Key` | `200 { message }` | Confirm, then invalidate/remove from lists. |
| `PATCH /users/me` | `{ username }` | `200 { message, user }` | Update the signed-in user's name; invalidate profile and post queries. |
| `POST /users/me/profile-image` | Multipart form field `image` | `200 { message, user }` | Upload an image (max 5 MiB); update the signed-in user's base64 data URI. |

All API endpoints are prefixed with `/api/v1`.

## Validation and error presentation

Client validation should match the backend for fast feedback, while API errors remain authoritative.

| Field | Rules |
| --- | --- |
| `username` | At least 2 characters |
| `email` | Valid email format |
| `password` | At least 8 characters; uppercase, lowercase, and number required |
| Create post `content` | Trimmed; 1–1000 chars; profanity is rejected server-side |
| Update post `content` | Trimmed non-empty string (the current endpoint does not enforce the 1000-character/profanity rules) |
| Search `q` | Trimmed non-empty string |
| Profile `username` | At least 2 characters after trimming |

Error behavior:

- `400` may be `{ errors: { fieldName: [message] } }` for schema validation or `{ message }` for other invalid input. Map `errors` to inputs and display `message` as a form/banner error.
- `401`: refresh once. If refresh fails, clear local user state and redirect to `/login` with the original target retained.
- `404` on update/delete: show the returned message and refetch the personal list.
- `409`: for an idempotency collision, preserve the form and ask the user to submit a new action; do not silently retry with a different key.
- `429` applies to login/signup only. Read `Retry-After`, disable the submit button until that time, and show a clear cooldown.
- `413` on profile image upload means the image exceeds 5 MiB; ask the user to select a smaller file.
- `500`: show a recoverable error with a retry control.

## UI and data-state requirements

- Display edit/delete controls only where `post.authorId` is the signed-in user’s ID. Because there is no `GET /me`, retain only the safe `user` object returned from successful login/signup for this comparison. It is cleared after a full page reload; on reload, show the authenticated feed but omit ownership controls until the backend provides a session-user endpoint.
- Treat `GET /posts` and search responses as unions: a `{ message }` response is an empty state, not an error.
- Preserve composer text on validation, network, and `409` errors.
- Disable create/delete while their request is in flight. For delete, keep the same idempotency key if offering a retry.
- Use optimistic updates only if rollback is implemented. A straightforward invalidate-and-refetch approach is safer for this initial version.

## Backend observations to resolve before production

1. Auth responses include access and refresh token strings in JSON despite already setting HttpOnly cookies. Remove these fields to reduce exposure.
2. Add `POST /logout` to clear both cookies and `GET /me` (or `GET /session`) to restore the user after refresh/reload.
3. `GET /posts` is not ordered, and it returns an object rather than `[]` when empty. Prefer a consistently ordered array plus pagination metadata.
4. Apply the same `createPostSchema` validation to updates so max length and profanity policies match create.
5. The idempotency cache is process-local and cleared on restart. For multi-instance production deployments, use a shared durable store.

## Handoff checklist

- Set the API environment variable and `credentials: 'include'`.
- Implement the API client before components; components must not call `fetch` directly.
- Build auth bootstrap with refresh-once behavior.
- Implement Login, Signup, Feed, My Posts, Composer, Editor, Search, and all loading/empty/error states.
- Verify with browser devtools that cookies are set and attached; never log or persist token response values.
- Confirm the production frontend origin is present in backend `CORS_ORIGINS` and both frontend and API use HTTPS.
