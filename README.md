# Loquor

*Latin, "I speak."*

An iOS speech-training app for people who want to be a contributor rather than a
listener — better questions, fewer fillers, a working vocabulary, and something
to say in the room. Runs inside Expo Go; there is no backend.

- **[PRD.md](PRD.md)** — the product, the five pillars, the design concept, and
  every constraint that decided the architecture.
- **[loquor/](loquor/)** — the app. See [its README](loquor/README.md) to run it.
- **[phase0/](phase0/)** — the STT filler-recall gate the whole product rests on.

## The one thing to understand

Delivery metrics — filler rate, pace, dead air, hedge density — are arithmetic
computed on the phone from word timestamps. The LLM judges content and is never
shown a delivery figure. An LLM asked "how many filler words?" answers
differently on Tuesday, and a 90-day trend built on that is worthless.

## Keys

Bring your own. They live in `expo-secure-store` on the device, are never
synced, never logged, and are sent only to the vendor they belong to. Nothing in
this repository contains a credential.
