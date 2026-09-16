import { signIn } from "@/auth";
import { brand } from "@/lib/brand";
import { Wordmark } from "@/components/Brand";

/**
 * Where to land afterwards.
 *
 * Only a path on this host: `//evil.example` is a valid relative URL to a
 * browser and would make this an open redirect, which on a sign-in page hands
 * an attacker a credible phishing hop.
 */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}

/**
 * Why she is on this screen, when there is a reason worth saying.
 *
 * A jot handed over on the apex is the highest-anxiety moment in the funnel and
 * the screen that asks for an email said nothing about it. Issue 005.
 */
function reason(next: string, stale: string | undefined): string | null {
  if (next.startsWith("/claim")) {
    return "Your jot is waiting. Signing in is what keeps it.";
  }
  if (stale) return "You have been signed out. Sign in again to carry on.";
  return null;
}

export default async function SignIn(
  { searchParams }: { searchParams: Promise<{ next?: string; stale?: string }> },
) {
  const params = await searchParams;
  const redirectTo = safeNext(params.next);
  const why = reason(redirectTo, params.stale);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <h1 className="mt-2">
          <Wordmark className="jd-wordmark-lg" />
        </h1>
        <p className="mt-2 opacity-70">{brand.line}</p>
      </div>

      {why ? (
        <p className="max-w-xs text-center text-sm opacity-70">{why}</p>
      ) : null}

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo });
        }}
      >
        <button type="submit" className="btn btn-primary">
          Continue with Google
        </button>
      </form>

      {process.env.ALLOW_DEV_LOGIN === "true" && process.env.NODE_ENV !== "production" && (
        <form
          className="flex w-full max-w-xs flex-col gap-2 border-t border-base-300 pt-6"
          action={async (formData: FormData) => {
            "use server";
            await signIn("dev", {
              email: String(formData.get("email") ?? ""),
              redirectTo,
            });
          }}
        >
          <p className="text-xs jd-quiet">
            Developer sign-in. Local only, and refuses to run in production.
          </p>
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="input w-full"
            style={{ fontSize: 16 }}
          />
          <button type="submit" className="btn btn-ghost btn-sm">
            Sign in without Google
          </button>
        </form>
      )}
    </main>
  );
}
