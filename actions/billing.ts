"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { createCheckoutUrl, createPortalUrl } from "@/lib/services/billing";

export async function checkoutAction(
  _formData?: FormData,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const { id, email, name } = session.user;
  const result = await createCheckoutUrl({ id, email, name });
  if ("error" in result) {
    if (result.code === "CONFLICT") {
      redirect("/billing?checkout=already-subscribed");
    }
    throw new Error(result.error);
  }

  redirect(result.data.url);
}

export async function portalAction(
  _formData?: FormData,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const result = await createPortalUrl(session.user.id);
  if ("error" in result) {
    throw new Error(result.error);
  }

  redirect(result.data.url);
}
