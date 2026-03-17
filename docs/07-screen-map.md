# Viprosell â€” SCREEN MAP

**Phase:** 01 â€” Foundation Design  
**Date:** 2026-03-09

---

## 1. Public Screens

| # | Screen | Route | Access | Purpose |
|---|---|---|---|---|
| 1 | Landing | `/` | guest | Hero, packages, demo, pricing, FAQ, CTA |
| 2 | Login | `/login` | guest-only | Email/password login |
| 3 | Signup | `/signup` | guest-only | Email/password registration |

## 2. Authenticated Screens (DashboardLayout)

| # | Screen | Route | Access | Purpose |
|---|---|---|---|---|
| 4 | Dashboard | `/dashboard` | user | Projects list, credits, plan, quick actions |
| 5 | New Project | `/projects/new` | user | 4-step wizard: package â†’ source â†’ category â†’ options |
| 6 | Product Analysis | `/projects/:id/analysis` | user (owner) | AI product intelligence results |
| 7 | Concept Selection | `/projects/:id/concepts` | user (owner) | 3 commerce angles with scoring |
| 8 | Script + Render | `/projects/:id/script` | user (owner) | Script view, scene cards, render trigger, preview |
| 9 | Billing | `/billing` | user | Plans, credits, payment history, checkout |
| 10 | Affiliate | `/affiliate` | user | Referral link, commission wallet, event log |

## 3. Admin Screens (DashboardLayout + AdminGuard)

| # | Screen | Route | Access | Purpose |
|---|---|---|---|---|
| 11 | Admin Settings | `/admin/settings` | admin | System toggles, service URLs, health, logs |

## 4. Screen Flow

```
Landing â†’ Signup/Login â†’ Dashboard
                            â†“
                     New Project Wizard
                     (package â†’ source â†’ category â†’ options)
                            â†“
                     Product Analysis
                            â†“
                     Concept Selection
                            â†“
                     Script + Render
                            â†“
                     Dashboard (project completed)
```

## 5. UI States per Screen

Every data-driven screen must implement:
- **Loading** â€” skeleton/spinner while fetching
- **Empty** â€” no data yet, with guided CTA
- **Error** â€” failed fetch/action, with retry
- **Data** â€” normal view with content

## 6. Sidebar Navigation

| Item | Route | Icon | Visibility |
|---|---|---|---|
| Dashboard | `/dashboard` | LayoutDashboard | all users |
| New Project | `/projects/new` | Plus | all users |
| Billing | `/billing` | CreditCard | all users |
| Affiliate | `/affiliate` | Users | all users |
| Admin Settings | `/admin/settings` | Settings | admin only |
