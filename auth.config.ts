import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const protectedPaths = ["/dashboard", "/shifts"];
      const isProtected = protectedPaths.some((path) =>
        request.nextUrl.pathname.startsWith(path),
      );
      if (isProtected && !isLoggedIn) {
        return false;
      }
      return true;
    },
  },
  providers: [],
};
