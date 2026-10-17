// Names match lucide icon ids and the "icon" column seeded in database/prisma/seed.sql.
export const CATEGORY_ICON_NAMES = [
  "tag",
  "utensils",
  "coffee",
  "car",
  "fuel",
  "plane",
  "house",
  "receipt",
  "shopping-bag",
  "shirt",
  "smartphone",
  "heart-pulse",
  "dumbbell",
  "graduation-cap",
  "film",
  "users",
  "baby",
  "paw-print",
  "shield",
  "gift",
  "circle-ellipsis",
  "wallet",
  "banknote",
  "award",
  "briefcase",
  "trending-up",
  "piggy-bank",
  "landmark",
  "hand-coins",
  "circle-plus",
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_NAMES)[number];

export const DEFAULT_CATEGORY_ICON: CategoryIconName = "tag";
export const DEFAULT_CATEGORY_COLOR = "#64748B";
