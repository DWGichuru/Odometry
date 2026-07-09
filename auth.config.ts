import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const protectedPaths = ["/dashboard", "/shifts", "/profile", "/import"];
      const isProtected = protectedPaths.some((path) =>
        request.nextUrl.pathname.startsWith(path),
      );
      if (isProtected && !isLoggedIn) {
        return false;
      }
      if (isProtected && isLoggedIn && auth.user.subscriptionAccess === false) {
        return Response.redirect(new URL("/billing", request.url));
      }
      return true;
    },
  },
  providers: [],
};
