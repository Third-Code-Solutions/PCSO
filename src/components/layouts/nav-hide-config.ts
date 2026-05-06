/**
 * Temporary navigation hide list.
 *
 * HOW TO RESTORE: remove the href from the array below (or delete the role key
 * entirely to restore all items for that role).  No routes, server actions, or
 * DB permissions are changed — this is purely a nav-tree filter.
 *
 * Keys are Role values.  Each value is the list of hrefs to suppress for that
 * role.  Redundant entries (items the role cannot see anyway) are harmless.
 */

import type { Role } from "@/lib/auth/permissions";

export const HIDDEN_ROUTES: Partial<Record<Role, readonly string[]>> = {};
