"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { sendVerificationEmail } from "@/actions/verify-email";
import { alertOnFailure } from "@/lib/alert";

export async function register(
  _prevState: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const name = (formData.get("name") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const password = formData.get("password") as string | null;
  const confirm = formData.get("confirm") as string | null;

  if (!name) {
    return { error: "Name is required." };
  }
  if (!email) {
    return { error: "Email is required." };
  }
  if (!password) {
    return { error: "Password is required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const trialEnd = new Date();
  trialEnd.setMonth(trialEnd.getMonth() + 1);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      credential: {
        create: { hashedPassword },
      },
      subscription: {
        create: {
          freeTrialEndsAt: trialEnd,
          status: "trialing",
        },
      },
    },
  });

  try {
    const customer = await getStripe().customers.create({ email, name });
    await prisma.subscription.update({
      where: { userId: user.id },
      data: { stripeCustomerId: customer.id },
    });
  } catch (err) {
    // Stripe unavailable -- user can still use the trial
    await alertOnFailure("User registration on stripe failed", err)
  }

  try {
    await sendVerificationEmail(email);
  } catch (err) {
    // Resend unavailable -- user can still request a new link from the sign-in page
    await alertOnFailure("Failed to send verification email", err)
  }

  return { success: true };
}
