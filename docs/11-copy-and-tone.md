# 11 — Copy and tone

> **Rewritten 2026-08-23 for the rebrand (ADR-072).** Until then this doc built a house
> register on kanninja's martial-arts vocabulary — the register the word *dojo* anchored.
> Jotacular does not inherit it. The tests, the Never table and the microcopy below all
> survive unchanged; what changed is the personality they serve.

## Voice

**Calm, plain, brief — and warm.** Confident without being clever. The product is for
someone with a thought they are about to lose, so every word we add is friction between
them and capturing it.

Three tests before any string ships:

1. **Would I say this out loud to a person?** If not, rewrite it.
2. **Does it survive being cut in half?** Usually yes. Cut it.
3. **Is it about the user's thought, or about our software?** Their thought wins.

## The mix

design.md §6 sets the dial, and it is worth stating as a ratio because it is easy to drift
to either end:

- **70%** capable, modern, polished
- **20%** playful, energetic
- **10%** weird, memorable

The 70% is the default and the floor. The other 30% shows up in *small moments* — a
confirmation, an empty state, the odd aside — and never in a string somebody needs in order
to operate the product. An error message is 100% the first number.

| Allowed | Banned |
|---|---|
| "Jot saved. Nice one." on a save confirmation | Personality in an error, a limit, or a consent screen |
| "Nothing here. Go have a thought." on an empty canvas | A joke that costs the reader a second read |
| A short human aside in marketing prose | Cuteness anywhere near billing or privacy |
| Warmth | Exclamation marks. Still no |

The line: **the product is playful about itself, never about the user's situation.** Losing
a note, hitting a limit, or handing an agent access are not moments for character.

### What the old register was, and why it is gone

kanninja names its objects in a domain vocabulary — boards are *dojo*, cards are *kata* —
and does it well, because that vocabulary names things and states principles rather than
making jokes. Jotacular used to borrow the frame. It no longer does: the name that anchored
it is gone, and the personality design.md asks for is friendly rather than disciplined.

The narrower rule that outlived it is still worth keeping: **a pun is never the answer.**
That was true when the register was martial and it is true now that it is warm.

### Do we rename "note"?

**No.** A note is a note and a space is a space.

Reason, unchanged by the rebrand and the most durable thing in this doc: capture must be
frictionless, and vocabulary is friction. Someone reaching for a phone at cheer practice
should not have to translate. A product can afford invented nouns when using it is a
deliberate, seated act; jotting is not.

The one word we do own is **jot**, and we own it because it is already English and already
a verb for exactly this. That is the opposite of an invented noun, which is why it costs
the reader nothing.

## Never

| Never | Because |
|---|---|
| Exclamation marks | We are not excited. The user is busy |
| "Oops!" / "Whoops!" | Something failed. Say what, and what to do |
| "Supercharge", "10x", "unleash", "magic", "revolutionary" | Marketing noise that says nothing |
| "AI-powered" as a value claim | Everything is. Say what it *does* |
| "Simply", "just", "easy" | If it were, we would not need to say so |
| Anthropomorphizing agents | "Claude added a comment," never "Claude thinks you should" |
| Blaming the user | "That did not save" — never "you did not save" |
| Emoji in product UI | Fine in a note the user wrote. Never in our chrome |

## Words we use

| Use | Not |
|---|---|
| **jot** (verb) | create, add, compose |
| **note** (noun) | entry, item, doc, page |
| **space** | workspace, team, org, vault |
| **agent** | AI, assistant, bot, copilot |
| **comment** | annotation, suggestion, insight |
| **capture** | save, sync, upload |
| **handwriting** | ink (internally ink is fine; to users it is handwriting) |

**Jotacular** in prose, sentence-case, like any other proper noun. The *wordmark* is
lowercase `jotacular` — that is artwork, not text, and the distinction matters: writing the
brand lowercase mid-sentence reads as a typo to everyone who is not us.

## Microcopy

### Empty states

    (canvas, first ever visit)
    Start jotting.

That is the whole thing. Three syllables and a full stop. No illustration, no tour, no "welcome to Jotacular" — the cursor is already blinking and the user already knows what a blank page is for.

    (no search results)
    Nothing matches "quarterly margins" yet.

    (notes list, all archived)
    Nothing here. Archived notes are in the overflow menu.

### Buttons

    Jot            Save            Done
    Keep this      Set up capture  Add to Home Screen
    Revert         Undo            Fix transcript

Verbs. Never "Submit", never "OK", never "Click here".

### Errors

State what happened, then what to do. No blame, no apology, no error code the user cannot act on.

    Good:  That did not send. It is saved on this device and will retry.
    Bad:   Oops! Something went wrong. Please try again later.

    Good:  Transcription paused — your limits reset on the 4th.
           Your handwriting is safe and will transcribe then.
    Bad:   Quota exceeded. Upgrade to continue.

The second pair matters more than it looks. A limit message that implies content is at risk will lose us the customer even when nothing was lost.

### Recognition states

    Transcribing...
    Handwritten, low confidence — tap to fix
    Could not read this. Your handwriting is still here.

Never say "failed" about someone's handwriting. The model failed, not their penmanship.

### Agent attribution

Every agent-authored element is labelled. Format:

    Claude · via MCP · 2h ago

In the review inbox:

    Claude appended 2 blocks to "Napkin idea".
    [ Keep ]  [ Revert ]

Flat and factual. No "Claude thought you might like..." — it did a thing, we report the thing.

### Consent screen

Plain verbs, never scope strings:

    Claude Desktop wants to:
      - read your notes
      - leave comments

    In these spaces:
      [x] Personal
      [ ] Family
      [ ] Acme

    Editing notes is off. You can turn it on later in Settings.

## Marketing copy

### Homepage hero

    Where the thought lands.

    Jot it on your phone in a second — typed, handwritten, spoken,
    or photographed. Your AI can read it all.

    [ Start jotting ]   no account needed

### The three-beat pitch

Capture, cognition, action — in the user's language:

    Catch it.     One second, one tap, any kind of thought.
    Keep it.      Handwriting, voice, and photos all become searchable text.
    Use it.       Connect Claude and ask it what you wrote.

### What we never say in marketing

- "The AI-powered note-taking app" — category framing we lose in.
- Any comparison chart against Notion or Obsidian. We lose feature counts; that is not the game.
- "Second brain."
- Promises about Gemini. The consumer Gemini app cannot add custom connectors — say Claude, and say ChatGPT with its limits, and stop.

### The line that does the work

> **Your notes, readable by your AI, from your phone, with no computer running.**

Long for a tagline, right for a subhead. It is the only sentence that states something no competitor can currently say.
