import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google,
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
      trialEnd.setMonth(trialEnd.getMonth() + 3);

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
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
