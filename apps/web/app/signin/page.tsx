import { signIn } from "@/auth";

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

export default async function SignIn(
  { searchParams }: { searchParams: Promise<{ next?: string }> },
) {
  const redirectTo = safeNext((await searchParams).next);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        {/* The seal. One per screen. */}
        <div
          aria-hidden
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-field bg-accent text-2xl text-accent-content"
        >
          覚
        </div>
        <h1 className="font-head text-4xl">jotdojo</h1>
        <p className="mt-2 opacity-70">Where the thought lands.</p>
      </div>

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
          <p className="text-xs opacity-50">
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
