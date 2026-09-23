---
name: printflow-interface
source: docs/specs/0004-design-system-ui-foundation/index.md
character: "A calm, precise print production interface with a warm white canvas, near black typography, and the OkPrints red reserved for decisive actions. Customer pages feel reassuring on a phone, while the admin workspace carries dense operational information with clear hierarchy."
tokens: "Semantic values live in src/app/globals.css and are resolved per shop by src/ui/theme."
contrast: "Body on paper 19.95:1, muted text on muted surface 7.21:1, ink on primary 4.94:1, paper on supporting red 5.39:1, focus ring on paper 5.39:1."
---

## Build mandate

Each full page needs store identity, clear context, useful content, action and failure states, and a considered ending. The customer journey should read from top to bottom on a phone. The admin workspace should make urgent work visible without sacrificing scanability.

## Character and direction

Use crisp type, generous outer space, soft paper surfaces, and restrained card borders. Use red for the primary action and small brand details. Status meaning comes from the fixed semantic status family, with words and icons as well as color.

## Composition patterns

Customer pages use a light header, one primary content column, and supporting order context beside or below it. Admin pages use a persistent workspace heading, compact navigation, summary metrics, and tables that become priority cards on narrow screens. Both shells reserve space for a logo or readable store name fallback.

## Component and usage rules

Use the project owned Base UI primitives under `src/ui/primitives`. Forms use labeled fields, descriptions, error association, and an inline outcome. Keep actionable controls at least 44 pixels tall on touch layouts. Use semantic tokens instead of literal colors in components. Use a short motion duration and honor reduced motion.

## Responsive and accessibility direction

The phone layout is the baseline. Keep tables readable by switching to cards with the same data and action semantics. Preserve visible focus, useful landmarks, meaningful link text, and an understandable page when client JavaScript is delayed. A broken logo must leave the store name visible.
