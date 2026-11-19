# Ludeo éducatif — Lot 4 (Service et boutique = monnaie): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Service cash step and the Shop educational (`monnaie`) at 3 levels; finish the "show what was expected" recap for every phase.

**Spec:** `docs/superpowers/specs/2026-11-19-educatif-design.md` — "7. Service et boutique", "Règles communes", "Précisions" (shop prices grouped by 5, piggy bank). Conventions: lot 1 plan.

## Global Constraints
- All previous constraints hold. Coins earned = score 0–5 as today; earned coins are never removed; at 0 the cash step is skipped.
- Stylised coins/notes (big "1", "2", "5", "10"), never real euro designs.
- N1: 1-coins, slide into the till, choose the total among 3 (dice); wrong → recount together (coins light up one by one), then continue.
- N2: 1 and 2 coins, sometimes a 5 note; choose the total among 3 (digits).
- N3: ticket shows amount due (= score); client pays 5 (later 10); she gives change from the till; ✓; wrong → client shows the difference; a reserve is provided if the till can't make change (not counted as earnings).
- Service result for `monnaie` = first answer right or wrong.
- Shop: N1 prices as 1-coins grouped by 5; N2 prices in numbers with coin icons; N3 also "how much is missing" with a piggy bank (coins grouped + number).
- `service` → `levels: 3` in PHASES. `CACHE_VERSION` → `'v9'`.

## Execution
Agent per task; final Opus review + one fix wave; art without waiting (sheet kept); merge to local master. Models: T1 Fable (worktree `feat/art-edu4`); T2 Sonnet; T3 Opus; T4 Sonnet.

## Review Focus
1. Payment generation: totals equal the score; N2 coin sets valid; N3 change always makeable from till + reserve. *(T2 test)*
2. Recount / difference feedback never blocks the flow; coins paid exactly once. *(T3)*
3. Shop affordability text-free at N1 (groups of 5 render up to 20). *(T3)*
4. Every phase's Service recap shows "what was expected" consistently across levels. *(T3)*

### Task 1: Art
`coin-1`, `coin-2`, `note-5`, `note-10` (stylised), `till` (cash register with drawer), `ticket`, `piggy-bank`, `counter-tray`. Review sheet; licences; manifest; notes; commit.

### Task 2: Logic
`src/logic/money.js` (create): `payment(score, level, rng) → {coins: number[], due?, paid?}`; `changeFor(due, paid, till) → coin[] | null`; `totalOf(coins)`; `choices(total, level, rng)` (3 options incl. the answer, distinct, in range). Tests per Review Focus. Commit.

### Task 3: Service cash step and Shop
Service: insert the cash step after the ✅/❌ reveal (N1/N2/N3 per spec), record the `monnaie` result, keep `round.paid` once-only. Recap: make sure every phase shows what was expected (audit lots 1–3 recaps; fill gaps). Shop: price rendering per level, piggy bank at N3. `service` → `levels: 3`. CDP per level; commit.

### Task 4: Smoke, cache v9, DEPLOY note
Smoke covers the cash step at each level and a shop purchase at N1/N3. Commit.
