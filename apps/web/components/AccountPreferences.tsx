import { ThemeChoice } from "./ThemeChoice";
import { setToolbarSideAction } from "@/app/actions";
import { railSide, type Align } from "@/lib/toolbar-side";

/**
 * How the app behaves for you: which side the tools sit on, and light or dark.
 *
 * Split out of the account page when ADR-119 edited it and its one function was
 * 93 lines against a limit of 50. The seam is the one the page was already a
 * list of: this is the part that changes nothing but what you look at.
 */
export function AccountPreferences({ side }: { side: Align }) {
  return (
    <>
      <section className="mb-10">
        <h2 className="font-head text-xl">Toolbar position</h2>
        <p className="mb-3 mt-1 text-sm jd-quiet">
          Which side of the page your tools sit on. Pick the side away from
          the hand you write with, so your hand never covers them.
        </p>
        <div className="flex gap-2">
          {(["left", "right"] as const).map((option) => (
            <form key={option} action={setToolbarSideAction.bind(null, option)}>
              <button
                type="submit"
                className={`btn btn-sm ${railSide(side) === option ? "btn-primary" : "btn-ghost"}`}
              >
                {option[0]!.toUpperCase() + option.slice(1)}
              </button>
            </form>
          ))}
        </div>
      </section>

      <ThemeChoice />
    </>
  );
}
