---
name: product-discovery
description: Use when conducting product discovery, defining problems to solve, validating hackathon or startup ideas, or when users are starting with a technology idea instead of a real user problem. Guides through a problem-first methodology using Socratic dialog across 6 sequential phases.
---

# Product Discovery

## Overview

Validate whether a problem is worth solving **before writing a single line of code**.

> Wish ≠ Problem. Validate first, build second.

**Core rule:** Never start with technology ("we want to use an LLM"). Always start with the real human problem behind it.

Use Socratic questions to surface the user's thinking at every phase. Do not move to the next phase until the current one produces a concrete output.

---

## Phase 1 — Problem-First Foundation

### Socratic Entry
Start by asking:
- "What problem are you solving?"
- If they answer with technology ("I want to use AI to…") → redirect: "What human problem does that solve?"
- "How do you know this problem exists? Have you seen it or talked to someone who has it?"

### 5x Why — Drill to Root Cause

Ask "why?" five times to get past symptoms to the root problem:

| Step | Question |
|------|----------|
| Why 1 | Why does this problem exist? |
| Why 2 | Why does *that* happen? |
| Why 3 | Why hasn't it been solved already? |
| Why 4 | Why do people tolerate the current situation? |
| Why 5 | Why would your solution be fundamentally different? |

### Problem Statement Canvas — 6 Tiles

All 6 must be filled before proceeding:

| Tile | Question to answer |
|------|--------------------|
| Context | When/where exactly does the problem appear? |
| Situation | What specific trigger causes it? |
| Problem | What is the exact difficulty? |
| Who | Who is affected — be specific, not "everyone" |
| Alternatives | How does the user cope today? |
| Consequences | What are the measurable/emotional impacts? |

### Output: One-Sentence Problem Statement

> *[User X] has a problem with [Problem] when [Context]. This causes them to feel [Emotion] and lose [Measurable gap]. They currently cope with [Alternative], which is ineffective because [Flaw].*

**Gate:** Can you fill every slot? If any slot is vague, you don't know the problem well enough yet.

---

## Phase 2 — User Persona & Segmentation

### Socratic Questions
- "Who exactly has this problem? Describe one real person, not a demographic."
- "Are they paying for this themselves (B2C) or through a company (B2B)?"
- "Are they an innovator willing to try unproven tools, or mainstream requiring proven ROI?"

### Persona Template

| Field | Content |
|-------|---------|
| Name + Role | Fictional but specific archetype |
| Goals & Motivations | What do they want to achieve? |
| Pains & Frustrations | What slows them down today? |
| Behaviors & Habits | How do they currently work? |
| Context of Use | When/where would they use the tool? |
| Voice of User | One sentence in their own words |

### B2C vs. B2B

| Dimension | B2C | B2B |
|-----------|-----|-----|
| Decision maker | User = payer | User ≠ payer ≠ budget owner |
| Sales cycle | Short | Long |
| Feature priority | UX and emotion | ROI and integration |
| Discovery approach | One persona | Map all three roles separately |

**Gate:** Does the persona have a name, role, at least 2 pains, and a quote? If not, it's a demographic, not a persona.

---

## Phase 2.5 — Competitive Differentiation (TRIZ)

TRIZ (Theory of Inventive Problem Solving) gives you a structured lens to understand *why* existing solutions fail your persona — and to prove that your product resolves a contradiction they cannot.

### Core Concept: Technical Contradiction

Every competitor accepts a trade-off. Improving Parameter A worsens Parameter B. They choose which to sacrifice.

| Domain | Parameter improved | Parameter worsened |
|--------|-------------------|-------------------|
| Fast food | Speed | Quality |
| Enterprise software | Features | Simplicity |
| Manual processes | Control | Speed |
| Automation tools | Speed | Flexibility |

Your goal: improve **both** parameters simultaneously. That is your defensible value proposition.

### Socratic Questions
- "What do current alternatives do well? What do they sacrifice to achieve that?"
- "What trade-off does every competitor in this space accept as unavoidable?"
- "If resources and constraints didn't exist, what would the perfect solution look like?"

### 3-Step TRIZ Competitive Analysis

| Step | Action | Output |
|------|--------|--------|
| 1. Map alternatives | List 2-3 solutions your persona uses today | Named alternatives |
| 2. Name the contradiction | "Alternatives improve [X] but at the cost of [Y]" | Explicit trade-off statement |
| 3. Define your resolution | "Our product improves [X] without sacrificing [Y] by [mechanism]" | Value proposition |

### Ideality Principle

Ask: *"What would the perfect solution look like if cost, complexity, and risk didn't exist?"*

The gap between the ideal and what competitors offer = your opportunity space. The closer your MVP gets to the ideal result with minimum added complexity, the stronger the product.

### Common TRIZ Parameters for Software Products

Use these to name trade-offs precisely:

| Parameter | What it describes |
|-----------|------------------|
| Speed / throughput | How fast the task gets done |
| Accuracy / reliability | How often the output is correct |
| Ease of use | How little effort the user expends |
| Adaptability | How well it fits different contexts |
| Cost / scalability | What it costs at volume |
| Automation level | How much AI/system does vs. user |
| Control / transparency | How much the user understands what happened |

**Output:** One sentence — *"Competitors trade [Parameter A] for [Parameter B]. We improve both by [mechanism]."*

**Gate:** Can you name the exact contradiction your product resolves? If you're only "better" in vague terms, you don't have a clear competitive position yet.

---

## Phase 3 — Process Modeling (As-Is → To-Be)

### Socratic Questions
- "Walk me through exactly what the user does today, step by step."
- "Where do they get stuck, work around the system, or use tools not meant for this?"
- "What would the process look like if this problem were fully solved?"

### As-Is Map (BPMN)

Visualize the current "dirty" process:

| Element | Purpose |
|---------|---------|
| Swimlanes | One per actor (user, system, third party) |
| Activities | What each actor does (rectangles) |
| Gateways | Decision points with yes/no branches (diamonds) |
| Shadow IT | Highlight workarounds — Excel sheets, WhatsApp, copy-paste rituals |

### Event Storming (Alternative Technique)

1. Write every event that happens on orange cards ("Order placed", "File uploaded")
2. Tell the story **backward** — what had to happen just before this event?
3. Gaps revealed = missing steps or broken logic in the current process

### To-Be Map

Design the improved process. Mark exactly where AI or automation removes the friction found in As-Is. Every removed step must map to a pain identified in the persona.

### Gap Analysis

Express the delta between As-Is and To-Be in measurable terms:
- Time saved per task (minutes/hours)
- Steps eliminated (count)
- Error rate before vs. after

**Gate:** Is the To-Be process a real improvement, or just the same process with a chatbot bolted on?

---

## Phase 4 — MVP Scoping

### Socratic Questions
- "What is the absolute minimum version that proves your hypothesis?"
- "Which feature, if removed, makes the product stop solving the problem entirely?"
- "What exactly are you testing with this MVP — demand, usability, or willingness to pay?"

### User Story Mapping

| Axis | Content |
|------|---------|
| Horizontal (Epics) | Major user activities in chronological order |
| Vertical (Stories) | Specific features under each activity |
| Top row | MVP — must-have for the product to work |
| Below | Optional, future releases |

### The One Story Rule

For the MVP: pick **one user story per epic**. Ship the skateboard, not the car.

```
Wishlist  →  Full car (all features, months of work)
MVP       →  Skateboard (it moves, solves the core need, proves demand)
```

### MVP Validation Hypothesis

Write this before building:
> *"We believe [persona] will [do X] because [Y]. We'll know we're right when [measurable signal]."*

### Common MVP Mistakes

| Mistake | Correction |
|---------|-----------|
| Too many features | One story per epic — enforce it |
| No hypothesis written before building | Write it now, before any code |
| Building without feedback loops | Ship to 5 real users before feature 2 |
| Ignoring feedback received | Feedback IS the product at this stage |
| Treating MVP as a "lite version" of the final product | MVP tests a thesis, not a feature list |

**Gate:** Can you state the one hypothesis this MVP tests? If not, you're building, not discovering.

---

## Phase 5 — Business Value & AI Ethics

### Socratic Questions
- "How will you know the product is working — what will you measure?"
- "What concrete value does the user get: time, money, emotional relief?"
- "Who is responsible when the AI gets something wrong?"

### KPI Definition

Set at least one metric per category:

| Category | Example KPI |
|----------|-------------|
| Efficiency | Time saved per user per session |
| Financial | Cost reduction (€/month) |
| Quality | Error rate vs. current baseline |
| Emotional | Stress score, NPS, support tickets |

### AI ROI Check

```
Value delivered per user session
> Cost of AI tokens per session × monthly volume
```

If this doesn't hold at the scale you're targeting, reconsider the AI use case. Recalculate with realistic token counts before pitching.

### Ownership & Safety

| Question | Must have an answer |
|----------|---------------------|
| Who reviews AI output? | Named human owner per action type |
| What prevents hallucinations from causing harm? | Filter, monitor, or block mechanism |
| What is the escalation path when AI is wrong? | Defined process, not "we'll handle it" |

**Gate:** If you cannot answer the ownership question, you are not ready to ship AI to real users.

---

## Phase 6 — Execution & Backlog

### Socratic Questions
- "If a developer picked up this ticket tomorrow with zero context, would they know what to build?"
- "Is every task traceable back to a user story from the story map?"
- "What is the single most important thing to build first?"

### Story Map → Kanban Ticket

Each user story becomes a ticket with:

| Field | Content |
|-------|---------|
| What | Feature description (1-2 sentences) |
| Why | Which user story and persona pain it addresses |
| Acceptance Criteria | How you know the ticket is done |
| Dependencies | What must exist before this can start |

### Team Roles

| Role | Responsibility |
|------|----------------|
| Leader / Facilitator | Protects the discovery process, blocks premature coding |
| Developer | Executes tickets, flags blockers and missing context |
| Product Owner | Owns the hypothesis, prioritizes the backlog |

**Gate:** Does every ticket in the backlog contain enough context to be worked on asynchronously?

---

## AI in Discovery

**Use AI to accelerate:**
- Generate interview questions for user research
- Draft an initial persona based on stated assumptions
- First version of the Problem Statement sentence
- Suggest relevant KPI frameworks

**AI cannot replace:**
- Talking to real users (minimum 5 interviews before building)
- Deciding which problems are worth solving
- Empathy, prioritization judgment, and ethical accountability

---

## Monetization Quick Reference

| Model | Mechanism | When to use |
|-------|-----------|-------------|
| SaaS Subscription | Monthly/annual access fee | Regular, recurring use |
| Freemium | Free core, paid advanced | Fast user-base growth, upsell later |
| Pay per Use | Fee per action or session | Irregular or high-volume bursts |
| Marketplace | % of transaction | Connecting buyers and sellers |
| B2B License | Enterprise deployment fee | Selling to companies, not individuals |
| White Label | Sell under buyer's brand | No own customer base yet |

---

## Final Validation Checklist

Run this before declaring "ready to build":

- [ ] Problem Statement fills all 6 canvas tiles with specific, non-generic answers
- [ ] At least one real person interviewed who actually has this problem
- [ ] Persona has name, role, 2+ pains, goals, context, and a direct quote
- [ ] TRIZ contradiction named: "Competitors trade [X] for [Y]. We improve both by [mechanism]."
- [ ] As-Is process mapped with shadow IT and bottlenecks identified
- [ ] To-Be shows exactly where the product removes friction (not just "AI does it")
- [ ] Gap Analysis expresses improvement in measurable units
- [ ] MVP is one user story per epic — not a feature list
- [ ] Hypothesis written: "We believe [X] will [Y] because [Z]. Validated when [signal]."
- [ ] KPIs defined with baseline and target numbers
- [ ] AI ownership and hallucination risk addressed with named owners
- [ ] Every backlog ticket is self-contained and developer-ready
