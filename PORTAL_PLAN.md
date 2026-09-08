# PORTAL_PLAN.md — supplier portal scope

Working notes from the MUREZA supplier deck and the live sales platform.
Nothing here is built yet; the site is currently the hero only.

## Brand (from sales.mave.africa)

| | |
|---|---|
| Wordmark | `assets/brand/mureza_logo.png` — 156×16 white MUREZA. **Only size that exists**; `/images/mureza.png`, `.svg`, `@2x` etc. all 404. Never scale above 156px. |
| Favicon | `assets/brand/favicon-mave.jpg` — gold MAVE "M". Served as `.png` on the live site but the bytes are JPEG. |
| Typeface | DM Sans (fallback Manrope) |
| Palette | Base `#0a0a0a`, text `#fff`, gold/tan accent on primary CTAs |

The portal keeps the warmer `#1b140e` base because it is driven by the
film's baked grade — the two sites are siblings, not clones.

**Open question:** the header now reads MUREZA wordmark + "SUPPLIER PORTAL".
The repo is `mave-supplier-portal` and the deck is *SUPPLIER DEVELOPMENT –
MAVE*, so MAVE is the company and MUREZA the OEM brand. If the portal should
lead with MAVE instead, that is a one-line swap — but MUREZA is the only
wordmark asset that exists.

## Tier structure (deck p3, matches the site's bottom bar)

| Tier | Partners | Focus areas |
|---|---|---|
| Tier 1 | 12 | Body panels, powertrains, seating, cockpits, braking |
| Tier 2 | 10 | Steel/aluminium processing, injection moulding, rubber, sensors |
| Tier 3 | 10 | Critical raw materials — lithium, copper, iron ore, rare earths |
| Services & Tech | 10 | Product design, CAD/CAE, robotics, quality testing labs |
| Infrastructure | 8 | SEZ land, 20–60 MW power, port/rail access, telecom |
| **Total** | **50** | |

Tier 1 detail (deck p4): body stampings & panels; powertrain systems;
electrical architecture (ECU + wiring harness); HVAC & cockpit systems.

Services detail (deck p6): product design/CAD, tooling & die makers,
automation systems, homologation to SABS / KEBS / NAFDAC type-approval and
NCAP.

Positioning (deck p2, p8): AfCFTA 1.3B-person market; local manufacturing
over import dependency; SEZs in South Africa, Ethiopia, Kenya; sovereign
supply chain. Pillars: OEM catalyst, 50+ partners, market lead, local
impact, onboarding.

## Requested functionality

1. **Registration fee per tier** — each tier carries a fee at sign-up.
2. **Record and document storage** — suppliers' records held server-side,
   with documents available for download.
3. **Client-side upload** — suppliers submit documents; managed through a
   linked CMS.
4. **Backend** — Firebase, reusing the existing app.

### Firebase

The sales platform serves vehicle imagery from:

```
firebasestorage.googleapis.com/v0/b/mave-invest-prod.firebasestorage.app
```

So the project is **`mave-invest-prod`**, with a `vehicles/` bucket path
holding `villager`, `shona`, `hunter-ev`, `t-one`, `svovi`. Same project can
carry the portal: Auth for supplier accounts, Firestore for applications and
tier records, Storage for documents, and Firestore rules to keep each
supplier scoped to their own records.

### Not yet specified — needed before building

- **Fee amounts per tier.** Not in the deck; it contains no pricing at all.
  Also needed: currency (deck is pan-African, sales site prices in ZAR),
  whether the fee is once-off or recurring, and whether it is refundable or
  credited against qualification.
- **Payment provider.** The sales site takes deposits (R19 983 on the
  Villager), so there may already be a processor wired into
  `mave-invest-prod` worth reusing rather than adding a second one.
- **Which CMS.** "Linked CMS" could mean a Firebase-backed admin screen in
  this app, or an external system. Different builds.
- **Document taxonomy.** What a supplier must upload (company registration,
  tax clearance, BEE/ownership, ISO/IATF certification, capability
  statement?) and what they download (NDA, RFQ pack, homologation specs?).
- **Approval workflow.** Who reviews an application, what the states are,
  and what the applicant sees at each one.

## Current state

Hero only — scroll-driven Villager disassembly, 240 frames. Nav links,
JOIN NETWORK, DETAILS hotspot and the tier bar are all inert. The tier bar
is the natural entry point for tier detail and registration.
