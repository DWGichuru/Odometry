import { Platform } from "@/types/shift";

export const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.UBER]: "Uber",
  [Platform.LYFT]: "Lyft",
  [Platform.DOORDASH]: "DoorDash",
};

// Tailwind needs literal class names, so platform styles are looked up, not built.
export const PLATFORM_BADGE: Record<Platform, string> = {
  [Platform.UBER]:
    "bg-[color-mix(in_srgb,var(--uber)_12%,transparent)] text-uber",
  [Platform.LYFT]:
    "bg-[color-mix(in_srgb,var(--lyft)_12%,transparent)] text-lyft",
  [Platform.DOORDASH]:
    "bg-[color-mix(in_srgb,var(--doordash)_12%,transparent)] text-doordash",
};

export const PLATFORM_FILL: Record<Platform, string> = {
  [Platform.UBER]: "bg-uber",
  [Platform.LYFT]: "bg-lyft",
  [Platform.DOORDASH]: "bg-doordash",
};
