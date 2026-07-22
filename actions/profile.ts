"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSupportedCurrency } from "@/lib/currency";
import { alertOnFailure } from "@/lib/alert";

type UpdateResult = { success: true } | { error: string };
type PreferencesResult =
  | { currency: string; distanceUnit: "KM" | "MI" }
  | { error: string };

export async function getProfilePreferences(): Promise<PreferencesResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currency: true, distanceUnit: true },
  });

  return {
    currency: user?.currency ?? "USD",
    distanceUnit: user?.distanceUnit ?? "MI",
  };
}

export async function updateProfilePreferences(
  currency: string,
  distanceUnit: string,
): Promise<UpdateResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  if (!isSupportedCurrency(currency)) {
    return { error: "Unsupported currency." };
  }

  if (distanceUnit !== "KM" && distanceUnit !== "MI") {
    return { error: "Unsupported distance unit." };
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { currency, distanceUnit },
    });
  } catch (err) {
    await alertOnFailure("Failed to update profile preferences", err);
    throw err;
  }

  return { success: true };
}
