"use server";

import { auth, signOut } from "@/auth";
import { deleteAccount as deleteAccountForUser } from "@/lib/services/account";
import { isFailure } from "@/lib/services/result";

export async function deleteAccount(password?: string): Promise<{ error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const result = await deleteAccountForUser(session.user.id, password || undefined);
  if (isFailure(result)) {
    return { error: result.error };
  }

  // signOut redirects by throwing, so this only returns on failure.
  await signOut({ redirectTo: "/" });
  return { error: "Could not sign you out." };
}
