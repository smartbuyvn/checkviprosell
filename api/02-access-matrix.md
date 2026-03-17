# Viprosell â€” ACCESS MATRIX

**Phase:** 01 â€” Foundation Design  
**Date:** 2026-03-09

---

## Role Definitions

| Role | Description |
|---|---|
| `guest` | Unauthenticated visitor |
| `user` | Authenticated user |
| `admin` | Admin user (stored in `user_roles` table) |
| `worker` | Internal service (signed requests) |

## Route Access

| Route Group | Guest | User | Admin | Worker |
|---|---|---|---|---|
| Public settings, plans | âœ… | âœ… | âœ… | âŒ |
| Auth (signup, login) | âœ… | âœ… | âœ… | âŒ |
| User profile (`/api/me`) | âŒ | âœ… own | âœ… | âŒ |
| Projects CRUD | âŒ | âœ… own | âœ… audit | âŒ |
| Assets upload | âŒ | âœ… own | âœ… audit | âŒ |
| Intel/concepts/scripts | âŒ | âœ… own | âœ… audit | âŒ |
| Render create/status | âŒ | âœ… own | âœ… audit | âŒ |
| Export | âŒ | âœ… own | âœ… audit | âŒ |
| Affiliate dashboard | âŒ | âœ… own | âœ… audit | âŒ |
| Billing checkout/history | âŒ | âœ… own | âœ… audit | âŒ |
| Admin settings | âŒ | âŒ | âœ… | âŒ |
| Admin usage/logs | âŒ | âŒ | âœ… | âŒ |
| Prompts management | âŒ | âŒ | âœ… | âŒ |
| Payment webhooks | âŒ | âŒ | âŒ | âœ… signed |
| Internal callbacks | âŒ | âŒ | âŒ | âœ… signed |

## RLS Enforcement

- Users can only read/write their own projects, assets, payments, affiliate data
- Admin can read all for audit purposes
- Worker endpoints require signed internal tokens
- Role checked via `user_roles` table with `has_role()` security definer function
