import { redirect } from "next/navigation";
import {
  getClient, resolveCimdClient, issueAuthCode, listSpaces,
  DEFAULT_SCOPES, SCOPES, type Scope, type ClientRecord,
} from "@jotacular/domain";
import { requireActor } from "@/lib/session";

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Plain verbs, never scope strings. docs/11-copy-and-tone.md. */
const SCOPE_LABELS: Record<Scope, string> = {
  "notes:read": "read your notes",
  "notes:comment": "leave comments",
  "notes:append": "add new notes and add to existing ones",
};

export default async function Authorize({
  searchParams,
}: { searchParams: Promise<Params> }) {
  const params = await searchParams;

  const clientId = one(params.client_id);
  const redirectUri = one(params.redirect_uri);
  const codeChallenge = one(params.code_challenge);
  const challengeMethod = one(params.code_challenge_method);
  const state = one(params.state);
  const resource = one(params.resource);
  const requested = one(params.scope).split(/\s+/).filter(Boolean) as Scope[];

  // Errors that cannot be safely redirected are shown here instead. Sending an
  // error to an unverified redirect_uri would make us an open redirector.
  if (!clientId || !redirectUri) return <Problem title="Missing client_id or redirect_uri" />;
  if (one(params.response_type) !== "code") return <Problem title="Only response_type=code is supported" />;
  if (!codeChallenge || challengeMethod !== "S256") {
    return <Problem title="PKCE is required" detail="code_challenge with code_challenge_method=S256." />;
  }
  if (!resource) {
    return <Problem title="A resource parameter is required" detail="RFC 8707. Tokens are bound to the server they are for." />;
  }

  let client: ClientRecord | null = null;
  try {
    // A client_id that is an https URL is a Client ID Metadata Document.
    client = clientId.startsWith("https://")
      ? await resolveCimdClient(clientId)
      : await getClient(clientId);
  } catch (err) {
    return <Problem title="That application could not be verified" detail={(err as Error).message} />;
  }
  if (!client) return <Problem title="Unknown client" detail="This application is not registered." />;

  // Exact match only. No wildcards, no prefixes.
  if (!client.redirectUris.includes(redirectUri)) {
    return <Problem title="That redirect address is not registered for this application" />;
  }

  const actor = await requireActor();
  const spaces = await listSpaces(actor);

  const scopes = (requested.length ? requested : DEFAULT_SCOPES)
    .filter((s): s is Scope => (SCOPES as readonly string[]).includes(s));

  const personal = spaces.find((s) => s.kind === "personal");

  async function approve(formData: FormData) {
    "use server";
    const grantedSpaces = formData.getAll("space").map(String);
    const grantedScopes = formData.getAll("scope").map(String) as Scope[];

    if (grantedSpaces.length === 0) {
      const url = new URL(redirectUri);
      url.searchParams.set("error", "access_denied");
      url.searchParams.set("error_description", "No space was selected");
      if (state) url.searchParams.set("state", state);
      redirect(url.toString());
    }

    const code = await issueAuthCode({
      actor: await requireActor(),
      clientId,
      redirectUri,
      codeChallenge,
      scopes: grantedScopes,
      spaceIds: grantedSpaces,
      resource,
    });

    const url = new URL(redirectUri);
    url.searchParams.set("code", code);
    if (state) url.searchParams.set("state", state);
    redirect(url.toString());
  }

  async function deny() {
    "use server";
    const url = new URL(redirectUri);
    url.searchParams.set("error", "access_denied");
    if (state) url.searchParams.set("state", state);
    redirect(url.toString());
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <h1 className="font-head text-2xl">
        {client.clientName ?? "An application"} wants access to Jotacular
      </h1>

      <form action={approve} className="mt-6">
        <fieldset className="mb-6">
          <legend className="mb-2 text-sm opacity-60">It will be able to</legend>
          <ul className="space-y-2">
            {scopes.map((scope) => (
              <li key={scope} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  name="scope"
                  value={scope}
                  id={`scope-${scope}`}
                  defaultChecked
                  className="checkbox mt-0.5"
                />
                <label htmlFor={`scope-${scope}`}>{SCOPE_LABELS[scope]}</label>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className="mb-6">
          <legend className="mb-2 text-sm opacity-60">In these spaces</legend>
          <ul className="space-y-2">
            {spaces.map((space) => (
              <li key={space.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="space"
                  value={space.id}
                  id={`space-${space.id}`}
                  // Never pre-select a shared space: that is somebody else's
                  // data, and granting it should be a conscious act.
                  defaultChecked={space.id === personal?.id}
                  className="checkbox"
                />
                <label htmlFor={`space-${space.id}`}>
                  {space.name}
                  {space.kind !== "personal" && (
                    <span className="ml-2 text-xs opacity-60">shared</span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">Allow</button>
          <button type="submit" formAction={deny} className="btn btn-ghost">Cancel</button>
        </div>
      </form>

      <p className="mt-6 text-xs opacity-50">
        You can revoke this at any time from Account. Nothing an agent does to your
        notes is permanent.
      </p>
    </main>
  );
}

function Problem({ title, detail }: { title: string; detail?: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <h1 className="font-head text-xl">{title}</h1>
      {detail && <p className="mt-2 text-sm opacity-60">{detail}</p>}
      <p className="mt-4 text-xs opacity-50">
        Nothing was granted. You can close this page.
      </p>
    </main>
  );
}
