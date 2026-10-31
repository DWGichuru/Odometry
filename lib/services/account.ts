import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { deleteCustomer } from "@/lib/stripe";
import { alertOnFailure } from "@/lib/alert";
import { fail, type ServiceFailure } from "@/lib/services/result";

export async function deleteAccount(
  userId: string,
  password?: string,
): Promise<{ success: true } | ServiceFailure> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      credential: { select: { hashedPassword: true } },
      subscription: { select: { stripeCustomerId: true } },
    },
  });
  if (!user) {
    return fail("NOT_FOUND", "Account not found.");
  }

  // Google-only users have no password to confirm; their session is the proof.
  if (user.credential) {
    if (!password) {
      return fail("VALIDATION_ERROR", "Enter your password to delete your account.");
    }
    if (!(await bcrypt.compare(password, user.credential.hashedPassword))) {
      return fail("UNPROCESSABLE", "Incorrect password.");
    }
  }

  // Stop billing before the user row is gone, so a Stripe failure never leaves a
  // deleted account that is still being charged.
  const customerId = user.subscription?.stripeCustomerId;
  if (customerId) {
    try {
      await deleteCustomer(customerId);
    } catch (err) {
      await alertOnFailure("Stripe customer deletion failed during account deletion", err);
      return fail("UPSTREAM_ERROR", "Could not cancel your subscription. Please try again.");
    }
  }

  // VerificationToken keys on email, not a relation, so it doesn't cascade.
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier: user.email } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  return { success: true };
}
