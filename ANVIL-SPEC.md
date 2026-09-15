# ANVIL — Business Formalisation Assistant

**Hackathon build specification · 36 hours · Track: Skill, Entrepreneurship and Employment**

> Working name is ANVIL. Swap it globally before submission if the team picks
> differently; it appears only in `app/layout.tsx`, the header component, and
> the PDF footer.

---

## 0. How to use this document

This file is the single source of truth. It is written to be opened in VS Code
and fed to Claude Code section by section. Paste-ready prompts are in §15.

**Reading order for a new team member:** §1 → §2 → §3 → §11 → §12.
**Reading order for a developer starting work:** §2 → §8 → §9 → §12 → §15.

Three conventions used throughout:

- `[VERIFY]` marks a factual claim — a threshold, fee, or deadline — that must
  be checked against the primary source before it ships. Every one of these has
  a verification gate in §12. Nothing marked `[VERIFY]` goes into the demo
  unverified.
- `[CUT]` marks scope that is explicitly out for the 36 hours. If someone starts
  building a `[CUT]` item, stop them.
- `[GATE n]` marks a checkpoint that requires pasted evidence before the team
  moves on.

---

## 1. The problem, stated precisely

A first-time Indian entrepreneur cannot find out what they are legally required
to do. Not because the information is secret, but because it is **distributed
across authorities who each publish only their own fragment**.

FSSAI publishes food licensing. CBIC publishes GST. EPFO publishes provident
fund. The state publishes shops and establishments. The corporation publishes
trade licence. The pollution board publishes consent categories. Nobody
publishes the union — "here is everything *you specifically* must do, in order."

The result is a predictable failure pattern:

1. The entrepreneur asks the wrong question. "How do I get a business loan"
   when the real answer is "you are four steps upstream of being fundable."
2. They get a partial answer, act on it, and discover the missing obligation
   only when penalised.
3. Or they pay an intermediary ₹15,000–40,000 for knowledge that is public.

**ANVIL closes the union gap.** It takes a description of an intended business,
resolves it to a set of regulatory attributes, and returns the complete,
ordered, cited set of obligations — registration, licensing, funding eligibility,
and post-launch compliance calendar.

### 1.1 What this is not

It is not a chatbot over scraped government websites. That build loses. At
least three other teams will have one, and it fails the only question that
matters in Q&A: *"what if it's wrong?"*

It is not legal advice, and the interface says so in plain words, once, in the
footer — not as a modal, not as a banner on every screen.

### 1.2 Success criteria for the demo

A judge names a business type nobody on the team anticipated — a tattoo studio,
a scrap dealer, a drone photography service — and the system produces a correct,
cited, ordered obligation set on stage, in under fifteen seconds, without a
code change.

That is the entire bar. Everything in this spec exists to clear it.

---

## 2. Architecture: two brains

**The single most important decision in this build.**

The LLM must never decide which licences apply. That is rule logic, not
retrieval logic. "Handles food, turnover under ₹12L, single premises →
FSSAI Basic Registration" is an `if` statement with a legal citation attached.

If a language model infers it, the output varies across runs. One of those runs
is the one the judge sees. Deterministic legal output is not a nice-to-have —
it is the product.

```
                          ┌─────────────────────────┐
   free text / voice ───▶ │   CLASSIFIER (LLM)      │
   "small pickle unit     │   text → attribute set  │
    from home"            │   + ambiguity questions │
                          └───────────┬─────────────┘
                                      │  attributes[]
                                      ▼
                          ┌─────────────────────────┐
                          │   RULE ENGINE (code)    │
                          │   deterministic         │
                          │   attributes →          │
                          │   obligations, ordered  │
                          └───────────┬─────────────┘
                                      │  obligation ids[]
                          ┌───────────┴─────────────┐
                          ▼                         ▼
              ┌───────────────────┐     ┌───────────────────────┐
              │  RULE FILE (JSON) │     │  RAG (pgvector +      │
              │  fees, timelines, │     │  rerank + Groq)       │
              │  documents, deps  │     │  explanation, Q&A,    │
              │  citations        │     │  citation retrieval   │
              └───────────────────┘     └───────────────────────┘
                          │                         │
                          └───────────┬─────────────┘
                                      ▼
                          ┌─────────────────────────┐
                          │   FOUR OUTPUT TABS      │
                          │   + PDF export          │
                          └─────────────────────────┘
```

### 2.1 Division of labour

| Concern | Owner | Why |
|---|---|---|
| "What kind of business is this?" | LLM classifier | Natural language is genuinely fuzzy |
| "What must they do?" | Rule engine | Must be identical every run |
| "Why must they do it?" | RAG | Needs the actual source text |
| "What does this cost / when is it due?" | Rule file | Fixed data, must be citable |
| "Free-form follow-up question" | RAG | Open-ended, grounded |
| "Can I afford this?" | Calculator | Arithmetic with visible inputs |

### 2.2 The rule that protects the demo

> The LLM emits attribute identifiers from a **closed enumeration** defined in
> §3. If it emits anything not in that list, the value is dropped and logged.
> The rule engine never receives free text.

This is enforced in code, not in the prompt. Prompt-level constraints fail under
demo pressure; a validation function does not.

---

## 3. Attribute taxonomy

**This is the core intellectual property of the project.** It is what no other
team will have, and it is the reason "all business types" is achievable in 36
hours rather than impossible.

### 3.1 The insight

No Indian law says "cafes need X." The law says:

- *anyone who handles food* → FSSAI
- *anyone occupying commercial premises* → Trade Licence, Shops & Establishments
- *anyone crossing an employee threshold* → EPF, ESI
- *anyone discharging effluent* → Pollution Board consent
- *anyone selling pre-packaged goods by weight* → Legal Metrology

Obligations attach to **what a business does**, not to what it is called.
Therefore: never author a rule for "cafe." Author ~30 attribute rules and let
them compose.

```
cafe          = { handles_food, prepares_food_onsite, customer_premises,
                  fire_risk_public, signage, employees_small }

pickle unit   = { handles_food, manufactures, packaged_goods_by_weight,
                  storage_goods, effluent_discharge_low }

salon         = { customer_premises, signage, employees_micro }

freelance dev = { home_based, services_only, interstate_supply }

scrap dealer  = { storage_goods, customer_premises, hazardous_handling,
                  local_authority_specific }
```

Same engine. No new code for any of them.

### 3.2 The closed enumeration

Thirty-one attributes. The classifier may emit only these strings.

**Nature of activity**

| id | Meaning |
|---|---|
| `handles_food` | Any contact with food for human consumption |
| `prepares_food_onsite` | Cooking or preparation at the premises |
| `manufactures` | Transformation of raw material into product |
| `assembles_only` | Assembly without material transformation |
| `services_only` | No goods sold |
| `trades_goods` | Buys and resells without transformation |
| `professional_regulated` | CA, legal, medical, architecture, engineering |

**Premises and physical footprint**

| id | Meaning |
|---|---|
| `customer_premises` | Customers physically enter |
| `home_based` | Operated from residential address |
| `storage_goods` | Holds inventory or warehouse |
| `owns_premises` | Owned, not rented |
| `signage` | External display board |
| `operates_vehicles` | Commercial vehicles in use |

**People**

| id | Meaning |
|---|---|
| `employees_none` | Sole operator |
| `employees_micro` | 1–9 |
| `employees_small` | 10–19 |
| `employees_medium` | 20–99 |
| `employees_large` | 100+ |
| `employs_women_night` | Women working after 8pm |
| `employs_contract_labour` | Contract workforce |

**Scale and market**

| id | Meaning |
|---|---|
| `turnover_below_threshold` | Below GST registration floor |
| `turnover_above_threshold` | Above GST registration floor |
| `interstate_supply` | Supplies outside home state |
| `sells_online` | E-commerce or marketplace |
| `imports_exports` | Cross-border trade |

**Risk and regulated handling**

| id | Meaning |
|---|---|
| `effluent_discharge_low` | Minor liquid waste |
| `effluent_discharge_high` | Significant industrial effluent |
| `emissions_air` | Air emissions |
| `fire_risk_public` | Public assembly or fire load |
| `packaged_goods_by_weight` | Pre-packed commodities sold by weight/measure |
| `alcohol` | Sale or service of alcohol |
| `hazardous_handling` | Hazardous or regulated substances |

### 3.3 Handoff sectors — do not attempt coverage

Some sectors have licensing regimes deep enough that a partial answer is worse
than no answer. Detect and hand off with the regulator name and starting point.

`pharmaceuticals` · `banking_nbfc` · `insurance` · `telecom` · `arms_ammunition`
· `formal_education` · `healthcare_clinical` · `aviation` · `mining`
· `petroleum_lpg`

This is roughly twelve lines of code and it prevents a catastrophic Q&A moment.
It also reads as engineering judgement, which scores.

---

## 4. Rule engine specification

### 4.1 Rule shape

Every obligation is one JSON object in `data/rules/obligations.json`.

```json
{
  "id": "FSSAI_BASIC",
  "name": "FSSAI Basic Registration",
  "category": "licence",
  "authority": "Food Safety and Standards Authority of India",
  "portal": "FoSCoS",
  "portal_url": "https://foscos.fssai.gov.in/",
  "triggers": {
    "all": ["handles_food"],
    "any": [],
    "none": [],
    "thresholds": {
      "annual_turnover_inr": { "max": 1200000 }
    }
  },
  "depends_on": ["ENTITY_REGISTRATION", "PREMISES_PROOF"],
  "blocks": ["TRADE_LICENCE_FOOD"],
  "fee_inr": 100,
  "fee_note": "per year of validity chosen",
  "timeline_days": [7, 15],
  "documents": [
    "Photo identity proof of proprietor",
    "Proof of premises (rental agreement or ownership document)",
    "Passport size photograph",
    "Food safety management plan (declaration form)"
  ],
  "renewal": { "cycle_months": 12, "grace_days": 30 },
  "penalty_note": "Operating without registration attracts penalty under FSS Act 2006",
  "citation": {
    "doc_id": "fssai_licensing_regs_2011",
    "locator": "Regulation 2.1.1",
    "url": "https://www.fssai.gov.in/",
    "verified_on": null,
    "verified_by": null
  },
  "confidence": "high"
}
```

### 4.2 Field contracts

- `triggers.all` — every attribute must be present
- `triggers.any` — at least one must be present (empty array = ignore)
- `triggers.none` — none may be present
- `triggers.thresholds` — numeric gates on profile values, `min` / `max` inclusive
- `depends_on` — obligations that must be completed first; drives ordering
- `blocks` — obligations that cannot start until this one completes
- `confidence` — `high` | `medium` | `sector_specific`. Anything below `high`
  renders with a visible "confirm with authority" marker in the UI.
- `citation.verified_on` — **null blocks the build.** See [GATE 3].

### 4.3 Resolution algorithm

```
resolve(profile):
  1. attributes ← classifier output, validated against §3.2 enumeration
  2. if profile.sector ∈ handoff_sectors → return HANDOFF result, stop
  3. matched ← [ r for r in rules if triggers_satisfied(r, attributes, profile) ]
  4. matched ← matched ∪ UNIVERSAL_BASE
  5. ordered ← topological_sort(matched, edges = depends_on)
  6. if cycle detected → throw, log, fall back to category order
  7. group ordered into phases: pre-launch / at-launch / ongoing
  8. return { obligations: ordered, phases, unresolved: [] }
```

Topological sort matters more than it looks. It is what turns a list into a
**pathway**, and the pathway is what the judge remembers. You cannot obtain a
trade licence without premises proof; you cannot obtain FSSAI without an entity.
Showing that dependency graph is the difference between a search result and a
plan.

### 4.4 The universal base

Applies to essentially every business, and is one rule set rather than many.
This alone produces 60–70% of a correct answer for any business type.

| Order | Obligation | Conditional on |
|---|---|---|
| 1 | Entity registration (proprietorship / partnership / LLP / Pvt Ltd) | always |
| 2 | PAN | always |
| 3 | TAN | if deducting TDS |
| 4 | Udyam Registration (MSME) | always — free, and gates most schemes |
| 5 | Current bank account | always |
| 6 | GST registration | turnover or interstate or e-commerce `[VERIFY]` |
| 7 | Shops & Establishments registration | if `customer_premises` or employees |
| 8 | Professional tax registration | state and local body specific `[VERIFY]` |
| 9 | Trade licence (local body) | if `customer_premises` |
| 10 | EPF registration | at employee threshold `[VERIFY]` |
| 11 | ESI registration | at employee threshold `[VERIFY]` |

### 4.5 Values requiring verification before ship

These are the figures most likely to be stale. Each one is a gate in §12.

| Value | Working figure | Source to verify against |
|---|---|---|
| GST registration threshold — goods | ₹40,00,000 `[VERIFY]` | CBIC notification |
| GST registration threshold — services | ₹20,00,000 `[VERIFY]` | CBIC notification |
| GST composition limit | ₹1,50,00,000 `[VERIFY]` | CBIC composition rules |
| FSSAI Basic Registration ceiling | ₹12,00,000 `[VERIFY]` | FSSAI Licensing Regulations |
| FSSAI State Licence band | ₹12L–₹20Cr `[VERIFY]` | FSSAI Licensing Regulations |
| EPF applicability | 20 employees `[VERIFY]` | EPF & MP Act |
| ESI applicability | 10 employees `[VERIFY]` | ESI Act, state notification |
| ESI wage ceiling | ₹21,000/month `[VERIFY]` | ESIC notification |
| Udyam micro limits | ₹1Cr investment / ₹5Cr turnover `[VERIFY]` | MSME notification |
| Udyam small limits | ₹10Cr / ₹50Cr `[VERIFY]` | MSME notification |
| PMEGP max project — manufacturing | ₹50,00,000 `[VERIFY]` | KVIC PMEGP guidelines |
| PMEGP max project — service | ₹20,00,000 `[VERIFY]` | KVIC PMEGP guidelines |
| MUDRA slab ceilings | Shishu / Kishore / Tarun / Tarun Plus `[VERIFY]` | MUDRA scheme page |
| CGTMSE guarantee ceiling | ₹5Cr `[VERIFY]` | CGTMSE circular |

> **Non-negotiable:** a figure that cannot be verified against a primary source
> within the build window is removed from the rule file, not guessed. The
> obligation still renders; the number renders as "confirm with authority."

---

## 5. Adaptive intake

The dashboard drives the conversation. The user does not need to know what to
ask — that is the whole point, since not knowing what to ask is the problem.

### 5.1 Flow

```
  Step 1   free text or Tamil voice
           "I want to start a small pickle unit from my home"
             │
             ▼
  Step 2   classifier → attributes + confidence + unresolved[]
             │
             ▼
  Step 3   ask ONLY the unresolved questions  (typically 3–5, never more than 7)
             │
             ▼
  Step 4   numeric profile capture — turnover estimate, employees, budget
             │
             ▼
  Step 5   resolve → render
```

The judge watches the system reason about what it needs to know. That beats a
fixed questionnaire, and it costs one extra LLM call.

### 5.2 Classifier contract

Single Groq call. Temperature 0. JSON-only response, no prose, no fences.

```
SYSTEM
You classify Indian business descriptions into regulatory attributes.
Respond with JSON only. No preamble, no markdown fences.

Emit attributes ONLY from this list: [ ...31 ids from §3.2... ]
Emit sector ONLY from: [ ...handoff list + "general" ... ]

For any attribute you cannot determine from the description, do not guess.
Place it in "unresolved" with a plain-language question a first-time
entrepreneur can answer without knowing any legal terms.

OUTPUT SHAPE
{
  "attributes": ["handles_food", "manufactures"],
  "sector": "general",
  "business_label": "Home-based pickle manufacturing",
  "unresolved": [
    { "attribute": "interstate_supply",
      "question": "Will you sell outside Tamil Nadu?",
      "options": ["Yes", "No", "Not sure yet"] },
    { "attribute": "employees_micro",
      "question": "How many people will work with you?",
      "options": ["Just me", "1-9", "10-19", "20+"] }
  ],
  "confidence": 0.82
}
```

**Validation in code, not prompt:**

```ts
const ATTRS = new Set(ATTRIBUTE_ENUM);
const clean = raw.attributes.filter(a => ATTRS.has(a));
const dropped = raw.attributes.filter(a => !ATTRS.has(a));
if (dropped.length) logger.warn({ dropped }, "classifier emitted unknown attributes");
```

### 5.3 Question writing rules

Questions are read by someone who has never filed a form. Applies to every
generated question and every static label in the product.

- No legal vocabulary. Not "Do you have effluent discharge?" but
  "Does your work produce waste water beyond normal washing?"
- No compound questions. One fact per question.
- Always offer "Not sure yet" — and treat it as a real answer that produces a
  conditional obligation marked "depends on", never a blocked flow.
- Never ask something already derivable. If `home_based` is set,
  do not ask about signage.

### 5.4 Voice input

Sarvam ASR, Tamil → text, feeds the same classifier. `[CUT]` for anything
beyond the Step 1 free-text field. Do not attempt voice navigation of the whole
dashboard; it will eat six hours and demo worse than a text field.

---

## 6. Corpus manifest

Target **300–400 chunks**. That is enough. More is worse — retrieval precision
falls faster than coverage rises at this scale.

### 6.1 Sources

| # | Source | What to take | Format | Priority |
|---|---|---|---|---|
| 1 | FSSAI / FoSCoS | Licensing regulations, licence categories, fee schedule, document lists | PDF | P0 |
| 2 | CBIC | GST registration rules, threshold notifications, composition scheme, return calendar | PDF/HTML | P0 |
| 3 | Udyam Registration portal | MSME classification criteria, registration process, benefits | HTML | P0 |
| 4 | India Code | TN Shops & Establishments Act 1947; Legal Metrology Act 2009 | PDF | P0 |
| 5 | EPFO | Applicability, contribution rates, return calendar | PDF/HTML | P0 |
| 6 | ESIC | Applicability, wage ceiling, contribution, state notifications | PDF/HTML | P0 |
| 7 | MCA | Entity type comparison, incorporation requirements, annual filings | HTML | P1 |
| 8 | KVIC PMEGP | Scheme guidelines, eligibility, subsidy structure | PDF | P1 |
| 9 | MUDRA | Loan slabs, eligibility, application route | HTML | P1 |
| 10 | CGTMSE | Guarantee cover, eligible institutions, fee | PDF | P1 |
| 11 | TNPCB | Consent to Establish / Operate, Red-Orange-Green-White categorisation | PDF | P1 |
| 12 | TN MSME Dept | NEEDS, UYEGP scheme guidelines | PDF | P1 |
| 13 | Coimbatore Corporation | Trade licence process, fee, documents | HTML | P1 |
| 14 | TN Fire & Rescue Services | NOC applicability and process | HTML | P2 |
| 15 | data.gov.in | MSME and scheme datasets — real REST API, free key | JSON API | P2 |
| 16 | MyScheme | Scheme eligibility data behind the portal frontend | JSON | P2 |

**P0 must be ingested and embedded before the clock starts.** P1 during hours
0–6. P2 only if ahead of schedule.

### 6.2 On APIs — the honest position

There is no government API that returns "licences required for a business type."
That absence *is* the problem being solved. Say this out loud in the pitch; it
is a strength, not a gap.

Consequence: the corpus is **pre-built and versioned**, not live-fetched. Every
chunk carries a `verified_on` date and the UI surfaces it. A visible freshness
stamp is a credibility feature and costs nothing.

### 6.3 Chunk record

```json
{
  "chunk_id": "cbic_gst_reg_threshold_003",
  "doc_id": "cbic_gst_registration",
  "authority": "CBIC",
  "title": "GST registration — aggregate turnover thresholds",
  "text": "…",
  "locator": "Section 22(1), read with Notification 10/2019-CT",
  "source_url": "https://…",
  "retrieved_on": "2026-09-14",
  "verified_on": "2026-09-14",
  "verified_by": "initials",
  "jurisdiction": "IN",
  "state": null,
  "attributes_hint": ["turnover_above_threshold", "interstate_supply"],
  "embedding": "vector(1024)"
}
```

`attributes_hint` is a cheap, high-value trick: it lets retrieval filter by the
user's resolved attributes before vector search runs. Precision jumps and it
costs one column.

### 6.4 Chunking rules

- Split on **legal structure** — section, regulation, clause — never on fixed
  token count. Legal text loses meaning when split mid-provision.
- Target 200–500 tokens. Hard ceiling 800.
- Prepend every chunk with its own breadcrumb:
  `"FSSAI Licensing Regulations 2011 › Chapter 2 › Regulation 2.1.1 — "`.
  This single line materially improves retrieval on short queries and makes
  citations render themselves.
- Never split a table across chunks. Serialise the whole table into one chunk.

---

## 7. Retrieval architecture

```
  query + resolved attributes
        │
        ├─▶ pre-filter: WHERE attributes_hint && user_attributes
        │                  OR attributes_hint IS NULL
        ▼
  pgvector cosine search, top 20        (bge-m3, 1024-dim)
        │
        ▼
  rerank top 20 → top 5                 (bge-reranker-v2-m3)
        │
        ▼
  confidence check: top score < 0.35 → ABSTAIN
        │
        ▼
  Groq llama-3.3-70b, temp 0.1, citations mandatory
        │
        ▼
  post-validate: every [n] marker maps to a real chunk, else strip and warn
```

### 7.1 Model choices and why

| Layer | Choice | Reason |
|---|---|---|
| Embedding | `BAAI/bge-m3` | Multilingual — a Tamil query retrieves English legal text. Run locally via sentence-transformers so venue wifi cannot kill retrieval. 1024 dims. |
| Reranker | `BAAI/bge-reranker-v2-m3` | **The highest-leverage hour in the build.** Raw vector search on legal text returns plausible-but-wrong sections constantly. The reranker fixes most of it. Do not skip this to save time. |
| Generation | Groq `llama-3.3-70b-versatile` | Sub-second first token. On stage, latency is felt more than marginal answer quality. Already in the team's stack. |
| ASR / TTS | Sarvam | Tamil, already in the team's stack |

No LangChain, no LlamaIndex, no agent framework. At 400 chunks these cost more
debugging time than they save. Write the ~120 lines directly.

### 7.2 Abstention — build it deliberately

The first Q&A question from any panel is "what if it's wrong." The answer is a
live demonstration, not a sentence.

```ts
if (rerankedTop.score < ABSTAIN_THRESHOLD) {
  return {
    abstained: true,
    message: "I don't have a verified source for that. " +
             "Here's the authority to contact instead.",
    authority: nearestAuthority(query)
  };
}
```

Tune `ABSTAIN_THRESHOLD` against the eval set in [GATE 5]. During the demo,
**deliberately ask something outside the corpus and let it decline on stage.**
Almost no team does this. It reads as maturity and it pre-empts the hard question.

### 7.3 Generation prompt

```
SYSTEM
You explain Indian business regulation to first-time entrepreneurs.

Rules:
- Answer ONLY from the provided sources. If they do not contain the answer,
  say so plainly and name the authority to contact.
- Cite every factual claim as [1], [2] matching the source numbers given.
- Never state a fee, threshold, or deadline that is not in the sources.
- Plain language. No legal jargon unless you define it in the same sentence.
- Maximum 150 words unless the user asked for detail.

USER PROFILE
{business_label}, {state}, {entity_type}, ~{turnover} turnover, {employees} staff

SOURCES
[1] {authority} — {title} ({locator}, verified {verified_on})
    {text}
[2] …
```

---

## 8. Data model

Supabase Postgres, `pgvector` enabled. Same database as everything else — one
less moving part at hour 30.

```sql
create extension if not exists vector;

-- corpus
create table documents (
  doc_id        text primary key,
  authority     text not null,
  title         text not null,
  source_url    text not null,
  retrieved_on  date not null,
  verified_on   date,
  verified_by   text,
  jurisdiction  text default 'IN',
  state         text
);

create table chunks (
  chunk_id         text primary key,
  doc_id           text references documents(doc_id) on delete cascade,
  title            text not null,
  breadcrumb       text not null,
  text             text not null,
  locator          text,
  attributes_hint  text[],
  embedding        vector(1024)
);

create index on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 32);
create index chunks_attrs_idx on chunks using gin (attributes_hint);

-- sessions (anonymous, no auth)
create table sessions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  raw_description text,
  attributes      text[],
  sector          text,
  business_label  text,
  state           text default 'TN',
  city            text,
  entity_type     text,
  turnover_inr    bigint,
  employees       int,
  budget_inr      bigint,
  premises        text
);

create table session_obligations (
  session_id     uuid references sessions(id) on delete cascade,
  obligation_id  text not null,
  phase          text not null,
  sort_order     int not null,
  primary key (session_id, obligation_id)
);

create table qa_log (
  id          bigserial primary key,
  session_id  uuid references sessions(id) on delete cascade,
  question    text,
  answer      text,
  chunk_ids   text[],
  abstained   boolean default false,
  top_score   real,
  latency_ms  int,
  created_at  timestamptz default now()
);
```

`qa_log` is not optional. It is the evidence for [GATE 5] and it produces the
accuracy number quoted in the pitch.

`[CUT]` — auth, users table, RLS policies, saved sessions across devices,
payment, teams.

---

## 9. API surface

Next.js route handlers. Six endpoints. No more.

| Route | Method | In | Out |
|---|---|---|---|
| `/api/classify` | POST | `{ description }` | `{ attributes, sector, business_label, unresolved[], confidence }` |
| `/api/resolve` | POST | `{ profile }` | `{ obligations[], phases, handoff?, session_id }` |
| `/api/ask` | POST | `{ session_id, question }` | `{ answer, citations[], abstained, top_score }` |
| `/api/feasibility` | POST | `{ session_id, overrides? }` | `{ capex[], opex[], breakeven_months, verdict, assumptions[] }` |
| `/api/schemes` | POST | `{ session_id }` | `{ schemes[] with met/unmet/unknown }` |
| `/api/export` | POST | `{ session_id }` | PDF stream |

Every response carries `{ generated_at, corpus_version }`. The PDF footer prints
both. Judges notice provenance.

---

## 10. Design language — Sovereign

Precision over decoration. One gold accent per screen, spent on the single most
important element and nowhere else.

The subject is regulatory compliance for people who find it intimidating. The
design job is to make the law feel **ordered and finite** rather than vast. That
means the interface's main expressive device is *structure* — sequence,
dependency, phase — not colour or illustration.

### 10.1 Tokens

```css
--ink:        #12100E;   /* near-black, warm — primary text */
--paper:      #FAF9F6;   /* base surface */
--slate:      #4A4744;   /* secondary text */
--rule:       #DEDAD2;   /* hairlines, dividers, table borders */
--gold:       #A67C00;   /* THE accent — one use per screen */
--flag:       #8C2F1E;   /* deadline overdue, unmet eligibility only */
```

`--flag` is not a general-purpose red. It appears only on a missed deadline or
a failed eligibility test. If it appears anywhere else, remove it.

### 10.2 Type

One family, two roles.

- **Display / obligation names:** `Fraunces`, weight 500, optical size tuned
  down. A serif with drawn-not-generated character; it carries the
  document-of-record feeling without looking like a newspaper pastiche.
- **Interface / body / data:** `Inter`, 400 and 500. Tabular numerals on for
  every fee, date, and threshold — `font-variant-numeric: tabular-nums`.

Scale: 13 / 15 / 17 / 22 / 30 / 42. Body 15/1.6. Line length ≤ 68 characters.

Sentence case everywhere. No all-caps labels, no tracked-out eyebrows, no
em-dash-fragment labels.

### 10.3 Structural rules

- Obligation cards are **not** uniform rounded boxes. They carry a 2px left
  border whose colour encodes phase: `--rule` pre-launch, `--ink` at-launch,
  `--slate` ongoing. The border is information, not decoration.
- Dependency is drawn, not implied. A hairline connector runs down the left
  gutter linking an obligation to its prerequisite.
- Border radius: 2px on interactive elements, 0 on containers. No shadows
  anywhere — separation is done with hairlines.
- Numbering appears **only** on the licence pathway, because that content
  genuinely is a sequence. Nowhere else.

### 10.4 Motion

One orchestrated moment: when the pathway resolves, obligations reveal in
dependency order, 40ms apart, opacity only — no translate. It shows the
sequence being computed. Nothing else on the site animates except direct
responses to clicks. `prefers-reduced-motion` disables it.

### 10.5 Where the gold goes, per screen

| Screen | Single gold element |
|---|---|
| Intake | The active question's left rule |
| Feasibility | The verdict figure |
| Pathway | The current next action |
| Funding | The single best-matched scheme |
| Calendar | The nearest upcoming deadline |
| Ask | The citation marker |


---

## 11. ASCII wireframes

### 11.1 Intake — step 1

```
┌──────────────────────────────────────────────────────────────────────┐
│  ANVIL                                            Tamil Nadu  ▾      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                                                                      │
│     What do you want to start?                                       │
│     Describe it the way you'd explain it to a friend.                │
│                                                                      │
│   ┃ ┌────────────────────────────────────────────────────────────┐   │
│   ┃ │ a small pickle unit from my home, selling in local shops   │   │
│   ┃ │                                                            │   │
│   ┃ └────────────────────────────────────────────────────────────┘   │
│   ↑                                                                  │
│  gold                              ( 🎙 Tamil )      [ Continue ]    │
│                                                                      │
│     ─────────────────────────────────────────────────────────────    │
│     Or start from an example                                         │
│     Cafe · Pickle unit · Salon · Freelance design · Scrap dealer     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

The example row doubles as the demo shortcut. Keep it in the shipped UI — it
reads as onboarding, and it gets you to any screen in one click during Q&A.

### 11.2 Intake — adaptive questions

```
┌──────────────────────────────────────────────────────────────────────┐
│  ANVIL                                            Tamil Nadu  ▾      │
├──────────────────────────────────────────────────────────────────────┤
│  Home-based pickle manufacturing                       Question 2/4  │
│                                                                      │
│   ┃  Will you sell outside Tamil Nadu?                               │
│   ┃                                                                  │
│   ┃    ( ) Yes                                                       │
│   ┃    (•) No                                                        │
│   ┃    ( ) Not sure yet                                              │
│  gold                                                                │
│                                                                      │
│        Already known from your description                           │
│        handles food · manufactures · works from home                 │
│                                                                      │
│                                          [ Back ]     [ Next ]       │
└──────────────────────────────────────────────────────────────────────┘
```

Showing what is already known is the feature that makes the diagnosis legible.
The judge sees the system reasoning rather than interrogating.

### 11.3 Results — tab shell

```
┌──────────────────────────────────────────────────────────────────────┐
│  ANVIL                                                    [ Export ] │
├──────────────────────────────────────────────────────────────────────┤
│  Home-based pickle manufacturing · Coimbatore · Proprietorship       │
│  ~₹8L turnover · 3 staff · ₹4L budget                    [ Edit ]    │
├──────────────────────────────────────────────────────────────────────┤
│  Feasibility │ Pathway │ Funding │ Calendar │ Ask                    │
│  ─────────────────────────────────────────────────────────────────   │
```

### 11.4 Pathway tab

```
│  11 obligations · 3 phases · est. 6–9 weeks · est. ₹14,200 in fees   │
│                                                                      │
│  BEFORE YOU START                                                    │
│                                                                      │
│  ┃ 1  Entity registration — Proprietorship                           │
│  ┃    Registrar not required. Proceed via PAN + bank account.        │
│  ┃    Free · 1–2 days                                     [ How ]    │
│  │                                                                   │
│  ┃ 2  Udyam Registration (MSME)                                      │
│  ┃    Free. Gates PMEGP, CGTMSE, and most state schemes.             │
│  ┃    Free · same day · udyamregistration.gov.in         [ How ]     │
│  │                                                                   │
│  ┃ 3  FSSAI Basic Registration                          ★ next       │
│  ┃    Required because you handle food, turnover under ₹12L.         │
│  ┃    ₹100/yr · 7–15 days                                [ How ]     │
│  ┃    Needs: 1, premises proof                                       │
│  ┃    Source: FSSAI Licensing Regulations 2011, Reg 2.1.1            │
│  ┃    Verified 14 Sep 2026                                           │
│  │                                                                   │
│  AT LAUNCH                                                           │
│                                                                      │
│  ┃ 4  Legal Metrology packer registration                            │
│  ┃    Because you sell pre-packed goods by weight.                   │
│  ┃    ⚠ Confirm fee with Controller of Legal Metrology   [ How ]     │
│  │                                                                   │
│  ONGOING                                                             │
│                                                                      │
│  ┃ 5  GST — not required yet                                         │
│  ┃    Your turnover is below the threshold and you sell only         │
│  ┃    within Tamil Nadu. This changes if either changes.             │
│  ┃    Source: CBIC, Section 22(1)                                    │
└──────────────────────────────────────────────────────────────────────┘
```

`★ next` is the gold element on this screen. The "not required yet, and here is
what would change that" card is worth building deliberately — it demonstrates
the rule engine reasoning about a negative, which no scraped chatbot can do.

### 11.5 Feasibility tab

```
│  Cost model: food manufacturing — small scale                        │
│  Every figure below is editable. Change anything to re-run.          │
│                                                                      │
│  ONE-TIME                                                            │
│    Premises deposit          [  60,000 ]   3 months, home-based n/a  │
│    Equipment & vessels       [ 1,40,000 ]  benchmark range 1.2–1.8L  │
│    Licences & registrations  [  14,200 ]   from your pathway         │
│    Initial raw material      [  45,000 ]                             │
│    Packaging & labelling     [  30,000 ]                             │
│                              ──────────                              │
│                               2,89,200                               │
│                                                                      │
│  MONTHLY                                                             │
│    Raw material              [  38,000 ]                             │
│    Labour (3)                [  36,000 ]                             │
│    Utilities                 [   6,000 ]                             │
│    Other                     [   5,000 ]                             │
│                              ──────────                              │
│                                 85,000                               │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────   │
│                                                                      │
│    Your budget ₹4,00,000 covers setup                                │
│    with ₹1,10,800 working capital — about 1.3 months of runway.      │
│         ↑ gold                                                       │
│    Thin. Most food units need 3 months. See Funding.                 │
│                                                                      │
│  Assumptions: benchmark ranges collected 14 Sep 2026 from local      │
│  supplier quotes and district industry centre data. Not a valuation. │
└──────────────────────────────────────────────────────────────────────┘
```

**This tab is the hallucination risk.** There is no grounded source for "can I
open a pickle unit with ₹4L." So it is a calculator with visible, editable
inputs and a stated assumption line — never an LLM answer.

Tier the cost models openly: food service, retail, small manufacturing, and
professional services get real modelled numbers. Every other sector shows:

```
│    Cost model not available for this sector.                         │
│    Licence, funding and compliance guidance below is still complete. │
```

Declining on the one unrounded thing while nailing the rest reads as judgement.
Faking it reads as a wrapper.

### 11.6 Funding tab

```
│  4 schemes matched · 2 you qualify for today                         │
│                                                                      │
│  ┃ PMEGP — Prime Minister's Employment Generation Programme  ★       │
│  ┃ Margin money subsidy on project cost                              │
│  ┃   ✓ New unit                    ✓ Udyam eligible                  │
│  ┃   ✓ Project within limit        ⚠ EDP training not done           │
│  ┃   Route: KVIC / DIC, Coimbatore                                   │
│  ┃   Source: PMEGP guidelines · verified 14 Sep 2026        [ How ]  │
│                                                                      │
│  ┃ MUDRA — Kishore                                                   │
│  ┃   ✓ Non-farm income generating   ✓ Within slab                    │
│  ┃   ? Bank relationship unknown                                     │
│                                                                      │
│  ┃ CGTMSE                                                            │
│  ┃   Collateral-free guarantee. Applies through your lender,         │
│  ┃   not applied for directly.                                       │
│                                                                      │
│  ┃ NEEDS (Tamil Nadu)                                                │
│  ┃   ✗ Requires degree/diploma qualification                         │
│  ┃   Not eligible based on what you've told us.                      │
```

Three states only: met `✓`, unmet `✗`, unknown `?`. Never infer an unknown into
a met. The `?` is honest and it prompts the user to supply the missing fact.

### 11.7 Calendar tab

```
│  Post-launch obligations                          next 12 months  ▾  │
│                                                                      │
│  ┃ 11 Oct    GST return — not applicable at current turnover         │
│  ┃ 31 Oct    Professional tax — half-yearly     ⚠ confirm with       │
│  ┃                                                 local body        │
│  ┃ 15 Nov    FSSAI — no action                                       │
│  ┃  7 Dec    TDS deposit — if you deduct                             │
│  ┃ 30 Apr    Udyam — annual update from ITR                          │
│  ┃ 14 Sep    FSSAI Basic Registration renewal   ★ 365 days           │
│                                                                      │
│  Dates derive from your registration date and entity type.           │
│  Confirm each with the issuing authority before relying on it.       │
```

### 11.8 Ask tab

```
│  Ask anything about your specific situation                          │
│                                                                      │
│  ┃ ┌──────────────────────────────────────────────────────────────┐  │
│  ┃ │ do I need a separate licence to sell on Amazon?              │  │
│  ┃ └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────   │
│                                                                      │
│  Selling through an e-commerce marketplace makes GST registration     │
│  compulsory regardless of your turnover [1]. Your FSSAI Basic         │
│  Registration would also need to move to a State Licence if your      │
│  turnover crosses ₹12 lakh [2]. No separate marketplace licence       │
│  exists.                                                              │
│                                                                      │
│  [1] CBIC — GST registration, Section 24(ix) · verified 14 Sep 2026  │
│  [2] FSSAI Licensing Regulations 2011, Reg 2.1.2 · verified 14 Sep   │
│      ↑ gold citation markers                                          │
│                                                                      │
│  ─────── abstention state ───────────────────────────────────────    │
│                                                                      │
│  I don't have a verified source for that.                            │
│  For drone operation permits, contact the Directorate General of     │
│  Civil Aviation. I can still help with everything else in your       │
│  pathway.                                                             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 12. Build schedule — 36 hours

Two developers (D1, D2) and two students (S1, S2). Clock starts at H+0.

### Before the clock — do this at home

Confirm the organisers permit pre-built datasets. Almost all do; data is not
application code. If this one does not, ingestion eats the first six hours and
§6 P1 sources are cut entirely.

If permitted, arrive with: P0 corpus downloaded, chunked, embedded, and a
`.sql` dump ready to restore. That is four hours recovered, and it is the
difference between a demo and a deck.

---

**H+0 → H+2 · Foundation**

| Who | Task |
|---|---|
| D1 | Next.js + Supabase + pgvector up, schema from §8 applied |
| D2 | Groq and Sarvam clients, `/api/classify` returning validated JSON |
| S1 | P0 corpus ingestion running |
| S2 | Attribute enumeration → TS const; begin `obligations.json` universal base |

> **[GATE 1] — H+2.** Paste into the team channel: the output of
> `select count(*) from chunks;` and one full `/api/classify` JSON response for
> "small pickle unit from my home". Both must be real terminal output, not
> described. No screenshots of code — output only.

---

**H+2 → H+8 · Rule engine**

| Who | Task |
|---|---|
| D1 | Resolver, topological sort, phase grouping, cycle detection |
| D2 | Retrieval: pgvector search, reranker, abstention, `/api/ask` |
| S1 | P1 corpus; `attributes_hint` tagging on every chunk |
| S2 | `obligations.json` to 25+ rules with citations |

> **[GATE 2] — H+8.** Paste `/api/resolve` output for all five example
> businesses from §3.1. Every one must return an ordered, non-empty obligation
> set with no cycle warnings. Paste the five raw JSON responses.

---

**H+8 → H+12 · Verification sweep**

All four people. This is not optional and it is not busywork.

Every `[VERIFY]` value in §4.5 is checked against its primary source. Whoever
checks it writes their initials and the date into the rule file. Any value that
cannot be confirmed is **deleted, not guessed** — the obligation still renders,
the number renders as "confirm with authority."

> **[GATE 3] — H+12.** Paste the output of:
> ```bash
> jq '[.[] | select(.citation.verified_on == null)] | length' data/rules/obligations.json
> ```
> Must return `0`. Also paste the verification table with initials against each
> row of §4.5.

---

**H+12 → H+20 · Interface**

| Who | Task |
|---|---|
| D1 | Intake flow, adaptive questions, session persistence |
| D2 | Pathway tab — this is the screen that wins or loses |
| S1 | Feasibility calculator + the four sector cost models |
| S2 | Funding and Calendar tabs |

Sleep rotation starts here. Two down at a time, four hours each. A team that
does not sleep demos worse than a team with one fewer feature.

> **[GATE 4] — H+20.** Paste a screen recording, under 60 seconds, going from
> free text to a rendered pathway with visible citations. No narration, no cuts.

---

**H+20 → H+26 · Ask tab, export, polish**

| Who | Task |
|---|---|
| D1 | Ask tab with citation rendering and the abstention state |
| D2 | PDF export |
| S1 | Sovereign design pass against §10 — tokens, type, gold audit |
| S2 | Eval set: 40 questions with known-correct answers |

> **[GATE 5] — H+26.** Run all 40 eval questions. Paste the table: question,
> retrieved chunk ids, abstained y/n, correct y/n. Target ≥ 85% correct with
> ≥ 90% of incorrect cases abstaining rather than answering wrongly. Tune
> `ABSTAIN_THRESHOLD` from this data and record the chosen value.

---

**H+26 → H+30 · Hardening**

Failure modes, in priority order:

1. Groq down or rate-limited → cached responses for the three demo profiles
2. Local embedding model slow → pre-compute demo query embeddings
3. Venue wifi fails → full local fallback, Supabase local instance
4. Reranker cold start → warm it at app boot, never on first request
5. Judge asks an unanticipated business type → this must work; it is the whole
   thesis. Test with at least ten types nobody has tried.

> **[GATE 6] — H+30.** Kill the network and run the full demo. Paste the
> recording. If it fails, fix it before adding anything.

---

**H+30 → H+34 · Demo rehearsal**

Full run-through five times. Different presenter each time — whoever is calmest
at H+34 presents. Script in §13.

**H+34 → H+36 · Freeze**

No new features. Deploy, verify the deployed URL, prepare the offline fallback,
and sleep for one hour.

---

## 13. Demo script — 5 minutes

**0:00–0:30 · The gap**
"FSSAI publishes food rules. CBIC publishes GST. EPFO publishes provident fund.
Nobody publishes the union. A first-time entrepreneur cannot find out what they
must do — and that gap costs them ₹15,000 to ₹40,000 paid to an agent for
information that is already public."

**0:30–1:30 · Live, in Tamil**
Speak the pickle unit description in Tamil. Show the adaptive questions. Point
at "already known from your description" — the system diagnosed rather than
interrogated.

**1:30–2:45 · The pathway**
Eleven obligations, three phases, dependency-ordered. Open one citation. Then
stop on the GST card: *"not required yet — and here is exactly what would change
that."* Say plainly: this is a rule engine, not a model guessing. It returns the
same answer every time.

**2:45–3:30 · The unanticipated type**
"Give me any business." Take it from the room. Run it live.

This is the moment the demo is won. Rehearse it with ten types.

**3:30–4:15 · Abstention**
Ask something outside the corpus. Let it decline on stage.
"We would rather return nothing than return something wrong. Our eval set is 40
questions — here is the accuracy, and here is the abstention rate."

**4:15–5:00 · Export and close**
Generate the PDF. "This is what the entrepreneur walks away with."
Close on the architecture: rules for what, retrieval for why, and a visible
verification date on every number.

### Rehearsed answers to the predictable questions

**"What if the law changes?"** Every chunk carries a `verified_on` date, shown
in the UI. The rule file is data, not code — updating a threshold is a one-line
change with no redeploy of logic. We would run a quarterly re-verification pass.

**"How is this different from ChatGPT?"** Ask ChatGPT this same question three
times and compare the licence lists. Ours is deterministic because licence
selection is rule logic, not generation. The model only classifies and explains.

**"Who verified the legal content?"** We did, against primary sources, and each
verification is initialled and dated in the data. It is not legal advice and the
product says so. Production would need a practising professional in the loop —
that is a stated limitation, not a hidden one.

**"Does this scale beyond Tamil Nadu?"** The universal base is national. State
scope is a data layer — the rule file has a `state` field. Adding a state is
data work, not engineering work.

---

## 14. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Stale legal figures | High | Fatal in Q&A | [GATE 3], `verified_on` everywhere, delete rather than guess |
| Retrieval returns plausible-wrong sections | High | High | Reranker (non-negotiable), `attributes_hint` pre-filter, abstention |
| Scope creep into all 28 states | Medium | High | TN only, hard-coded. `state` field exists but only TN is populated |
| Students idle at hour 20 | Medium | Medium | Ownership split in §12 is by artefact, not by "helping" |
| Feasibility numbers challenged by a local judge | Medium | High | Editable inputs, visible assumptions, sector tiering, explicit "not a valuation" |
| Groq rate limit mid-demo | Low | Fatal | Cached demo responses, [GATE 6] |
| Cycle in `depends_on` | Low | Medium | Detection + category-order fallback, tested in [GATE 2] |
| Judge asks a handoff sector | Medium | Low | Handoff path is a feature; demo it if it comes up |


---

## 15. Paste-ready prompts for Claude Code

Run these in order. Each assumes this file is open in the workspace at
`ANVIL-SPEC.md`. Do not run a later prompt until the preceding gate has passed.

---

### Prompt 1 — Scaffold and schema

```
Read ANVIL-SPEC.md sections 2, 8 and 9.

Scaffold a Next.js 14 App Router project with TypeScript, Tailwind, and
Supabase. No auth, no users table.

1. Apply the SQL schema in section 8 exactly as written, including the
   pgvector extension, the ivfflat index and the GIN index on attributes_hint.
2. Create src/lib/attributes.ts exporting the 31 attribute ids from section
   3.2 as a readonly const tuple, plus an ATTRIBUTE_SET Set for validation and
   a HANDOFF_SECTORS const from section 3.3.
3. Create empty typed route handlers for all six endpoints in section 9,
   returning 501 with the correct TypeScript response shapes defined in
   src/types/api.ts.
4. Create src/lib/groq.ts and src/lib/sarvam.ts as thin clients reading keys
   from env. No SDK wrappers beyond fetch.

Do not install LangChain, LlamaIndex, or any agent framework. Section 7.1
explains why.

Then print: the file tree, and the exact command to verify the schema applied.
```

---

### Prompt 2 — Ingestion pipeline

```
Read ANVIL-SPEC.md sections 6 and 7.

Build scripts/ingest.ts:

1. Read source PDFs and HTML from data/sources/, one subdirectory per doc_id.
2. Chunk on legal structure — section, regulation, clause boundaries — not on
   fixed token count. Target 200-500 tokens, hard ceiling 800. Never split a
   table; serialise the whole table into one chunk.
3. Prepend each chunk with its breadcrumb exactly as shown in section 6.4.
4. Embed with BAAI/bge-m3 via sentence-transformers, running locally. 1024 dims.
5. Write documents and chunks rows per the schema, including retrieved_on.
   Leave verified_on null - it is set by hand during the gate 3 sweep.
6. Support re-running idempotently on doc_id.

Also build scripts/tag-attributes.ts that lets a human assign attributes_hint
values to chunks from the section 3.2 enumeration, reading a simple CSV mapping.

Print the command to ingest a single doc_id and the command to count chunks.
```

---

### Prompt 3 — Classifier

```
Read ANVIL-SPEC.md section 5.

Implement POST /api/classify.

- Single Groq call, llama-3.3-70b-versatile, temperature 0, JSON-only.
- Use the system prompt in 5.2, injecting the attribute enumeration from
  src/lib/attributes.ts so the list can never drift from the code.
- Validate the response in code, not in the prompt: filter attributes against
  ATTRIBUTE_SET, log anything dropped at warn level with the raw value.
- If sector is in HANDOFF_SECTORS, return early with a handoff response.
- Unresolved questions must follow the writing rules in 5.3. Add a unit test
  asserting no generated question contains any of: effluent, statutory,
  compliance, aggregate turnover, establishment.

Add src/lib/__tests__/classify.test.ts covering the five example businesses in
section 3.1. Assert the expected attribute sets.

Print the test command and its output.
```

---

### Prompt 4 — Rule engine

```
Read ANVIL-SPEC.md section 4.

Implement the resolver in src/lib/resolve.ts and wire POST /api/resolve.

- Load data/rules/obligations.json, typed against the shape in 4.1.
- Implement triggers_satisfied honouring all, any, none and thresholds with
  inclusive min/max.
- Merge with the universal base from 4.4.
- Topological sort on depends_on. On cycle: log the cycle, fall back to
  category order, and set a warning flag on the response.
- Group into phases: pre-launch, at-launch, ongoing.
- Persist the session and session_obligations rows.

Then add a build-time validator script that fails if any rule has a
citation.verified_on of null, or references an unknown attribute id, or names a
depends_on target that does not exist. Wire it into npm run build.

Print the validator output against the current rule file.
```

---

### Prompt 5 — Retrieval

```
Read ANVIL-SPEC.md section 7.

Implement POST /api/ask in this exact pipeline order:

1. Pre-filter chunks: attributes_hint overlaps the session's resolved
   attributes, OR attributes_hint is null.
2. pgvector cosine search, top 20.
3. Rerank with BAAI/bge-reranker-v2-m3 to top 5. Warm the reranker at app boot,
   never on first request.
4. If reranked top score < ABSTAIN_THRESHOLD (env var, default 0.35), return the
   abstention response shape in 7.2 with the nearest authority. Do not call the
   LLM at all in this branch.
5. Otherwise call Groq with the prompt in 7.3.
6. Post-validate: every [n] citation marker in the output must map to a real
   chunk in the context. Strip any that do not and log a warning.
7. Write a qa_log row with chunk_ids, abstained, top_score and latency_ms.

Print a sample response for an in-corpus question and an out-of-corpus question.
```

---

### Prompt 6 — Interface

```
Read ANVIL-SPEC.md sections 10 and 11.

Build the UI. Section 10 is a fixed brief - follow it exactly, it is not a
starting point to improve on.

Non-negotiable:
- The six CSS custom properties from 10.1, defined once in globals.css.
- Exactly one element per screen uses --gold. Use the table in 10.5. Add a dev-
  only check that warns in console if more than one element on a route resolves
  to the gold token.
- --flag appears only on an overdue deadline or a failed eligibility test.
- Fraunces 500 for obligation names and display; Inter 400/500 for everything
  else. tabular-nums on every fee, date and threshold.
- Sentence case throughout. No all-caps labels, no tracked eyebrows, no
  em-dash-fragment labels, no arrow glyphs appended to buttons.
- Obligation cards: 2px left border encoding phase per 10.3. No shadows
  anywhere. Radius 2px interactive, 0 containers.
- Numbering only on the pathway tab.
- One motion moment only: pathway reveal in dependency order, 40ms stagger,
  opacity only, disabled under prefers-reduced-motion.

Build the screens exactly as wireframed in 11.1 through 11.8, including the
"not required yet" obligation state in 11.4 and the abstention state in 11.8.

Responsive to 380px. Visible keyboard focus on every interactive element.
```

---

### Prompt 7 — Feasibility

```
Read ANVIL-SPEC.md sections 11.5 and 14.

Build POST /api/feasibility and the feasibility tab.

This is a calculator, not an LLM call. Under no circumstances route any part of
this through a model.

- Four sector cost models in data/costs/: food-service, retail,
  small-manufacturing, professional-services. Each is a JSON file of line items
  with a benchmark range and a source note.
- Any sector outside those four renders the unavailable state in 11.5 verbatim.
  Do not estimate.
- Every input is editable and re-runs the calculation client-side.
- Licences and registrations line pulls its figure from the resolved pathway.
- The assumptions line names the collection date and states it is not a
  valuation.

The verdict figure is the single gold element on this screen.
```

---

### Prompt 8 — Export and hardening

```
Read ANVIL-SPEC.md sections 9, 12 H+26-H+30, and 14.

1. POST /api/export: server-side PDF of pathway, funding and calendar.
   Footer prints generated_at and corpus_version on every page. Match the
   Sovereign tokens - this is the artefact the user keeps.

2. Offline fallback: cache full responses for the three seeded demo profiles in
   data/demo-cache/. An env flag DEMO_OFFLINE=1 serves from cache for classify,
   resolve, ask and feasibility without any network call.

3. Warm the reranker and the embedding model at app boot.

4. Add scripts/eval.ts: reads data/eval/questions.json (40 entries with expected
   answers), runs each through /api/ask, and prints a table of question,
   retrieved chunk ids, abstained, correct, top_score. Print aggregate accuracy
   and abstention rate.

Run the eval and print the full table plus the aggregates.
```

---

## Appendix A — Environment

```bash
GROQ_API_KEY=
SARVAM_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ABSTAIN_THRESHOLD=0.35
CORPUS_VERSION=2026-09-14
DEMO_OFFLINE=0
```

## Appendix B — Repository layout

```
anvil/
├── ANVIL-SPEC.md              ← this file, the source of truth
├── data/
│   ├── sources/               one subdirectory per doc_id
│   ├── rules/obligations.json the core IP
│   ├── costs/                 four sector cost models
│   ├── eval/questions.json    40 eval questions
│   └── demo-cache/            offline fallback
├── scripts/
│   ├── ingest.ts
│   ├── tag-attributes.ts
│   ├── validate-rules.ts
│   └── eval.ts
└── src/
    ├── app/api/               six route handlers
    ├── lib/
    │   ├── attributes.ts      the closed enumeration
    │   ├── resolve.ts         rule engine
    │   ├── retrieve.ts        search + rerank + abstain
    │   ├── groq.ts
    │   └── sarvam.ts
    └── types/api.ts
```

## Appendix C — Gate summary

| Gate | Hour | Evidence required |
|---|---|---|
| 1 | H+2 | Chunk count query output; one full classify JSON |
| 2 | H+8 | Five raw resolve responses, all ordered and non-empty |
| 3 | H+12 | `jq` unverified-citation count returning 0; initialled verification table |
| 4 | H+20 | 60-second unedited screen recording, text → pathway |
| 5 | H+26 | 40-row eval table with aggregate accuracy and abstention rate |
| 6 | H+30 | Full demo recording with the network disabled |

No gate passes on a verbal report. Paste the output.
