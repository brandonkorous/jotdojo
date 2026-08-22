# 11 — Copy and tone

## Voice

**Calm, plain, brief.** Confident without being clever. The product is for someone with a thought they are about to lose — every word we add is friction between them and capturing it.

Three tests before any string ships:

1. **Would I say this out loud to a person?** If not, rewrite it.
2. **Does it survive being cut in half?** Usually yes. Cut it.
3. **Is it about the user's thought, or about our software?** Their thought wins.

## The house register

**Corrected after reading kanninja's live copy.** An earlier draft of this doc said the martial-arts reference lives in the name and the mark and nowhere else. That is wrong for this house: kanninja uses the vocabulary deliberately and well — boards are *dojo*, cards are *kata*, the disciplines are "Honed Reflexes" and "Honest Signal," and the mark carries 忍. jotdojo should sound like its sibling, not like a different company.

The real rule is narrower and more useful:

**The register is allowed as structural framing in marketing. It is banned in product microcopy, and banned as wordplay.**

| Allowed | Banned |
|---|---|
| A section headed "Practice" or "Discipline" on the marketing site | A button labelled "Unleash your inner ninja" |
| A domain noun with real meaning, used consistently | A pun. Ever |
| The seal, the character, the restraint | Belts, shuriken bullets, a "sensei" onboarding character |
| kanninja's "The model suggests. You decide. In that order." | "Slice through your notes" |

The distinction: kanninja's vocabulary **names things and states principles**. It never makes a joke. That is why it reads as confident rather than corny, and it is the line jotdojo holds too.

Inherit kanninja's principle line verbatim where it applies — **"The model suggests. You decide. In that order."** is a plain statement of our agent write policy (ADR-004), already in the house voice, already proven on a live product.

### Do we rename "note"?

kanninja renamed its core objects (board to *dojo*, card to *kata*). jotdojo **does not.** A note is a note and a space is a space.

Reason: capture must be frictionless, and vocabulary is friction. Someone reaching for a phone at cheer practice should not have to translate. kanninja can afford domain nouns because using a kanban board is a deliberate, seated act; jotting is not.

The register lives in the *marketing* voice and the mark instead. If this ever gets revisited, 覚え (*oboe*, a note or memory) is the candidate — but the default answer is no.

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

Lowercase `jotdojo` always, even sentence-initial.

## Microcopy

### Empty states

    (canvas, first ever visit)
    Start jotting.

That is the whole thing. Three syllables and a full stop. No illustration, no tour, no "welcome to jotdojo" — the cursor is already blinking and the user already knows what a blank page is for.

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
