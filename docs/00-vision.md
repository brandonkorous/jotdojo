# 00 — Vision

## The thesis

**A thought arrives at an inconvenient moment.** In a bar, at cheer practice, in the car, three minutes before a meeting. The phone or tablet is always there. Almost nothing else is.

Jotacular exists to close the gap between *having the thought* and *the thought being useful*. It does that by splitting the job in three:

| Act | Where it happens | Rule |
|---|---|---|
| **Capture** | Jotacular, on a phone, in under a second | Dumb, instant, never blocks |
| **Cognition** | asynchronously, server-side | Makes the capture legible to humans and agents |
| **Action** | an agent, via MCP — often into **kanninja** | Delegated, never hardcoded |

Most note apps do act one and stop. Most task apps assume act one already happened somewhere else. Jotacular does act one properly and makes acts two and three *possible* without owning them.

## Why this can exist now

Agent access to notes is real but almost entirely **local**: Amplenote runs an MCP server from its desktop app, Obsidian goes through a local REST plugin, the Apple Notes servers shell out to AppleScript on a Mac. Every one of those requires a computer that is on and logged in.

If your notes live on your phone, that entire ecosystem is unavailable to you.

A web-only, server-of-record product is the **only** shape that can hand an agent your notes at 11pm with the laptop closed. The "it's just a website" constraint and the "MCP is essential" requirement are the same decision, not two competing ones.

## What we are not

Saying no to these is what keeps the product small enough for one person to ship.

- **Not a PKM system.** No graph view, no backlinks-as-religion, no daily-note methodology. If someone wants Obsidian, they should use Obsidian.
- **Not a wiki or a docs tool.** No nested page trees, no databases, no formulas.
- **Not a task manager.** That's kanninja. Jotacular never grows a "due date" field.
- **Not enterprise.** No SSO/SAML, no SCIM, no audit export, no SOC 2 pursuit. That's a year of work we are deliberately not doing.
- **Not a native app.** Not yet, and not required — see [14-native-apps.md](14-native-apps.md).
- **Not an AI chat window bolted to a notes list.** The intelligence lives in the user's own agent, reached over MCP. We provide the substrate, not the chatbot.

## The competitive position

We lose a feature comparison against Notion, Obsidian, and Apple Notes. We win on one axis nobody else occupies:

> **Your notes are reachable by your agent, from your phone, with no computer running.**

That's the sentence. Everything on the roadmap either serves it or gets cut.

Defensibility is not the `/mcp` endpoint — Notion could ship one in a quarter. Defensibility is the things that only matter *because* agents read the notes:

1. **Multimodal capture that all normalizes to agent-readable text.** Ink, voice, and photos are opaque to agents everywhere else. Here they become markdown with a confidence score.
2. **Attribution and reversibility.** Every agent write is attributed, commented by default, and revertible. Nobody does this because nobody else designed for agents writing.
3. **Suite composition.** Two tight MCP servers (Jotacular + kanninja) an agent holds at once beats one bloated one.

## The suite

**kanninja** is the sibling: MCP-first kanban. The intended flow is that a user asks their agent to read a Jotacular note and build a plan in kanninja. The integration happens *in the agent*, not in our code — we get the value with zero integration engineering.

We keep them separate products. See [15-decision-log.md](15-decision-log.md), ADR-002.

## What success looks like

Deliberately modest and honest:

- **6 months:** the founder uses it daily instead of Apple Notes, and the note → agent → kanninja loop works end to end.
- **12 months:** 50–100 paying accounts, mostly families and sub-10-person teams. Low four figures MRR.
- **Failure signal:** capture takes more than a second, or the founder still opens Apple Notes when a thought hits. That's fatal and no amount of MCP fixes it.

## Values

**Simple. Easy. Affordable. Useful.** In that order, and they are constraints, not slogans — a feature that makes the app less simple has to buy its way in.
