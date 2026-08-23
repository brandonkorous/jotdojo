"use client";

import { useState, useTransition } from "react";
import {
  createCaptureTokenAction, revokeCaptureTokenAction,
} from "@/app/actions";
import type { CaptureTokenSummary } from "@jotacular/domain";

/**
 * Capture token management. docs/09-shortcuts.md.
 *
 * The token is shown exactly once, because only its SHA-256 is stored. The UI
 * has to be honest about that rather than implying it can be retrieved later.
 */
export function CaptureTokens({
  tokens, spaces, apiUrl,
}: {
  tokens: CaptureTokenSummary[];
  spaces: { id: string; name: string }[];
  apiUrl: string;
}) {
  const [fresh, setFresh] = useState<{ token: string; name: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  return (
    <section>
      <h2 className="font-head text-xl">One-tap capture</h2>
      <p className="mb-4 mt-1 text-sm opacity-60">
        A capture token lets an iOS Shortcut add notes without opening Jotacular. It can
        create a note in one space and nothing else — it cannot read, list, or search.
      </p>

      <form
        className="mb-6 flex flex-wrap items-end gap-2"
        action={(formData) => {
          startTransition(async () => {
            setCopied(false);
            setFresh(await createCaptureTokenAction(formData));
          });
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs opacity-60">Name</span>
          <input
            name="name"
            defaultValue="iPhone"
            className="input"
            style={{ fontSize: 16 }}
          />
        </label>
        {spaces.length > 1 && (
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-60">Space</span>
            <select name="spaceId" className="select" style={{ fontSize: 16 }}>
              {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Creating\u2026" : "Create token"}
        </button>
      </form>

      {fresh && (
        <div className="mb-6 rounded-box border border-accent p-4">
          <p className="mb-2 text-sm">
            <strong>Copy this now.</strong> It is not stored and cannot be shown again.
          </p>
          <code className="block break-all rounded-field bg-base-300 p-3 font-mono text-xs">
            {fresh.token}
          </code>
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-2"
            onClick={async () => {
              await navigator.clipboard.writeText(fresh.token);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <ShortcutRecipe token={fresh.token} apiUrl={apiUrl} />
        </div>
      )}

      {tokens.length === 0 ? (
        <p className="text-sm opacity-60">No capture tokens yet.</p>
      ) : (
        <ul className="divide-y divide-base-300">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0">
                <div className="font-head">{t.name}</div>
                <div className="text-xs opacity-50">
                  {t.spaceName} &middot;{" "}
                  {t.lastUsedAt ? `last used ${t.lastUsedAt.toLocaleString()}` : "never used"}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm ml-auto"
                onClick={() => startTransition(() => revokeCaptureTokenAction(t.id))}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ShortcutRecipe({ token, apiUrl }: { token: string; apiUrl: string }) {
  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-sm">Set up the Shortcut on iPhone</summary>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
        <li>Open <strong>Shortcuts</strong> and create a new shortcut named <strong>Jot</strong>.</li>
        <li>Add the <strong>Dictate Text</strong> action.</li>
        <li>
          Add <strong>Get Contents of URL</strong> with URL{" "}
          <code className="font-mono text-xs">{apiUrl}/v1/capture</code>
        </li>
        <li>
          Set Method to <strong>POST</strong>, Headers{" "}
          <code className="font-mono text-xs">Authorization: Bearer {token.slice(0, 14)}…</code>{" "}
          (paste the whole token), Request Body to <strong>JSON</strong> with a{" "}
          <code className="font-mono text-xs">text</code> field set to the Dictated Text.
        </li>
        <li>
          Say <strong>&ldquo;Hey Siri, Jot&rdquo;</strong>. Add it to the Action Button or
          the Lock Screen too.
        </li>
      </ol>
      <p className="mt-3 text-xs opacity-60">
        Works from a locked phone and while driving. Nothing is transcribed on our side —
        Apple&rsquo;s on-device dictation does the work and we receive text.
      </p>
    </details>
  );
}
