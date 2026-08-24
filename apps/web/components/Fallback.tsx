import { Wordmark } from "@/components/Brand";

/**
 * The shell every dead end shares. ADR-106.
 *
 * A 404, a thrown error and a refused OAuth grant are all the same moment for
 * the reader: they wanted something and did not get it. One layout, so the
 * edges of the product look like the product.
 */
export function Fallback({
  title,
  children,
  actions,
  reference,
}: {
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  reference?: string;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-7 px-6 text-center">
      <Wordmark />

      <div>
        <h1 className="font-head text-2xl">{title}</h1>
        {children ? (
          <div className="mt-3 text-sm leading-relaxed opacity-70">{children}</div>
        ) : null}
      </div>

      {actions ? <div className="flex flex-wrap justify-center gap-2">{actions}</div> : null}

      {/* The digest is the only handle we have on a specific failure, and the
          reader is the one holding it. Quiet, but present. */}
      {reference ? (
        <p className="font-mono text-xs opacity-40">Reference {reference}</p>
      ) : null}
    </main>
  );
}
