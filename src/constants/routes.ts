/**
 * Viprosell â€” Route definitions
 * Single source of truth for all app routes.
 */

export const ROUTES = {
  // Public
  LANDING: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  PRICING: '/pricing',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  AUTH_CALLBACK: '/auth/callback',

  // Authenticated
  DASHBOARD: '/dashboard',
  NEW_PROJECT: '/projects/new',
  PROJECT_ANALYSIS: '/projects/:projectId/analysis',
  PROJECT_CONCEPTS: '/projects/:projectId/concepts',
  PROJECT_SCRIPT: '/projects/:projectId/script',
  BILLING: '/billing',
  ACCOUNT: '/account',
  AFFILIATE: '/affiliate',

  // Admin only
  ADMIN_SETTINGS: '/admin/settings',
} as const;

export type RouteKey = keyof typeof ROUTES;

/**
 * Build a parameterized route path.
 */
export function buildRoute(
  route: string,
  params: Record<string, string>
): string {
  let result = route;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`:${key}`, value);
  }
  return result;
}
