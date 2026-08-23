import NextAuth, { type NextAuthResult } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { upsertUserFromGoogle } from "@jotacular/domain";

/**
 * Dev-only sign-in, so the app can be used before Google OAuth is configured.
 *
 * Safe BY CONSTRUCTION rather than by assertion: the provider is only added
 * when NODE_ENV is not production, so no environment variable can switch on a
 * password-free login on a real deployment. An earlier version threw instead,
 * which was worse in two ways -- it broke `next build` (which runs with
 * NODE_ENV=production), and a thrown error is a runtime check that has to be
 * reached, where this cannot be reached at all.
 *
 * Delete this provider once Google OAuth is set up. It exists to unblock local
 * work, not as a feature.
 */
const DEV_LOGIN =
  process.env.ALLOW_DEV_LOGIN === "true" && process.env.NODE_ENV !== "production";

if (process.env.ALLOW_DEV_LOGIN === "true" && process.env.NODE_ENV === "production") {
  console.error(
    "[auth] ALLOW_DEV_LOGIN is set but NODE_ENV=production, so it has been ignored. Remove it from the production environment.",
  );
}

const nextAuth = NextAuth({
  providers: [
    Google,
    ...(DEV_LOGIN
      ? [
          Credentials({
            id: "dev",
            name: "Developer sign-in",
            credentials: { email: { label: "Email", type: "email" } },
            async authorize(credentials) {
              const email = String(credentials?.email ?? "").trim().toLowerCase();
              if (!email.includes("@")) return null;
              // Namespaced subject so a dev account can never collide with a
              // real Google identity for the same address.
              const { id } = await upsertUserFromGoogle({
                googleSub: `dev:${email}`,
                email,
                displayName: email.split("@")[0] ?? email,
              });
              return { id, email, name: email.split("@")[0] ?? email };
            },
          }),
        ]
      : []),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // Dev provider: authorize() already resolved our user id.
      if (account?.provider === "dev" && user?.id) {
        token.jotacularUserId = user.id;
        return token;
      }
      if (account && profile?.sub) {
        const { id } = await upsertUserFromGoogle({
          googleSub: profile.sub,
          email: String(profile.email),
          displayName: profile.name ?? null,
          avatarUrl: (profile as { picture?: string }).picture ?? null,
        });
        token.jotacularUserId = id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.jotacularUserId) {
        session.user.id = token.jotacularUserId as string;
      }
      return session;
    },
  },
});

/**
 * Explicit annotations rather than `export const { ... } = NextAuth(...)`.
 *
 * next-auth's inferred types reference paths inside its own dependency tree,
 * which pnpm's strict node_modules layout makes unnameable (TS2742). Naming the
 * types off NextAuthResult is the documented workaround and is deterministic.
 */
export const handlers: NextAuthResult["handlers"] = nextAuth.handlers;
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn;
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut;
export const auth: NextAuthResult["auth"] = nextAuth.auth;

declare module "next-auth" {
  interface Session {
    user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  }
}
