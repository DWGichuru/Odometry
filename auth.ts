import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import bcrypt from "bcryptjs";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { hasAccess } from "@/lib/subscription";

export class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (
          typeof credentials.email !== "string" ||
          typeof credentials.password !== "string"
        ) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { credential: true },
        });

        if (!user?.credential) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.credential.hashedPassword,
        );

        if (!valid) return null;

        if (!user.emailVerified) {
          throw new EmailNotVerifiedError();
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  session: { strategy: "jwt" },
  events: {
    async createUser({ user }) {
      const trialEnd = new Date();
      trialEnd.setMonth(trialEnd.getMonth() + 1);

      await prisma.subscription.create({
        data: {
          userId: user.id!,
          freeTrialEndsAt: trialEnd,
          status: "trialing",
        },
      });

      try {
        const customer = await getStripe().customers.create({
          email: user.email!,
          name: user.name ?? undefined,
        });
        await prisma.subscription.update({
          where: { userId: user.id! },
          data: { stripeCustomerId: customer.id },
        });
      } catch {
        // Stripe unavailable -- user can still use the trial
      }
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        const sub = await prisma.subscription.findUnique({
          where: { userId: user.id },
          select: { status: true, freeTrialEndsAt: true, isLifetimeFree: true },
        });
        token.subscriptionAccess = hasAccess(sub);
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      session.user.subscriptionAccess = Boolean(token.subscriptionAccess);
      return session;
    },
  },
});
