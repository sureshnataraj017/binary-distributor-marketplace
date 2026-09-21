# Binary Marketplace: Distributor & Retailer Network Dashboard

A React + TypeScript dashboard and a Node (Fastify) REST API for managing a binary distributor network:
retailer onboarding, sales, commissions, referrals and the company downline commission.

```bash
npm install
npm run dev        # starts the API (:3001) and the web app (:5173) together; open http://localhost:5173
npm test           # 134 tests: domain rules, database, API, and full-stack UI tests
npm run build      # typecheck (web + server) + production web build
```

Run them separately with `npm run dev:server` and `npm run dev:web`. Vite proxies `/api` to the server, so
the browser sees one origin and no CORS setup is needed. Env vars: `PORT` (default 3001),
`DB_PATH` (default `server/data/marketplace.db`), `RESET_DB=1` (rebuild the demo data on start) and
`SIMULATE_LATENCY_MS` (adds a delay per request, to see loading skeletons).

Demo aid: append `?simulateError` to any page URL. The client sends an `x-simulate-error` header and the
server answers 503, so you can see every error state. The server ignores this header when
`NODE_ENV=production`.

## Routes

| Route                   | Screen                                                                       |
| ----------------------- | ---------------------------------------------------------------------------- |
| `/dashboard`            | 9 KPI cards, 14-day sales chart, commission mix, onboarding leaders          |
| `/distributors/network` | Interactive binary tree (zoom, pan, expand/collapse, hover popup, selection) |
| `/distributors/:id`     | Profile, daily target ring, retailers, recent commissions                    |
| `/retailers/:id`        | Retailer profile, totals, recent sales, **Record a sale** form               |
| `/retailers/:id/sales`  | Sales table: search, date range, sort, pagination, totals, CSV               |
| `/commissions`          | Commission ledger with filters and CSV export                                |
| `/referrals`            | Referral tracking with payment status                                        |

The global **India state filter** (top bar) re-scopes the dashboard, network tree, ledger and referrals.

**Record a sale** (retailer page) is the full write path: the form validates in the browser (amounts are parsed
from text to integer cents without floats) and shows a live preview of the split from the shared commission
engine. On submit, `POST /api/sales` re-validates, checks the retailer is eligible, calculates the split itself
and stores it in one transaction. The UI then shows the **server-confirmed** split and invalidates the
sales and ledger caches, so the retailer totals, recent sales and the ledger update without a reload. Only
active retailers can sell; if the server refuses (for example a future-dated onboarding record), its reason is shown.

## Architecture

```
src/
  types/        Plain data models (Distributor, Retailer, Sale, LedgerEntry, Referral)
  config/       commissionConfig.ts: every rate lives here, never in a component
  domain/       Pure TypeScript, no React. All business rules, fully unit-tested
    commissionEngine.ts   calculateCommission(), calculateReferralCommission()
    onboardingRules.ts    same-day logic, duplicates, invalid/cancelled records
    treeBuilder.ts        flat list -> binary forest, upline tracing, data-issue reporting
    ledger.ts             business events -> normalized commission ledger
    metrics.ts            dashboard KPIs and per-distributor summaries
    scope.ts              state filter applied to every dataset
  services/     HTTP boundary: apiClient.ts (the only place that calls fetch) + one service per resource
  hooks/        useMarketplaceData (base), useDistributors, useRetailers, useCommissions, useBinaryTree
  store/        Zustand: state filter, tree selection/collapse, theme
  components/   ui/ (atoms) . common/ (molecules) . features/ (tree, nodes, tooltip, charts) . layout/
  pages/        One file per route (lazy-loaded)
  routes/       AppRoutes
server/         Node + Fastify REST API
  app.ts        buildApp(): hooks, error handling, route registration (also used by the tests)
  routes/       distributors, retailers, sales, commissions
  store.ts      SQLite persistence behind a Store interface (schema, constraints, queries, seeding)
  seed.ts       Seeded, deterministic data with edge cases planted on purpose
  index.ts      Process entry point
```

The server imports the pure `src/domain`, `src/config` and `src/types` directly, so the browser and the
server run the _same_ commission engine and rules. In a larger codebase these would move into a shared package.

**Rule:** JSX never computes money. Components call hooks; hooks call services and the domain layer.

### Why this state management

- **TanStack Query** owns _server state_ (fetching, caching, loading/error/retry). Hand-rolling that in
  Redux or Context means re-implementing caching and request lifecycles.
- **Zustand** owns the small amount of _client state_ (selected state, expanded nodes, selected node, theme).
  It needs no provider or boilerplate and avoids Context's "everything re-renders" problem, which matters with
  a large tree.
- Redux Toolkit would be the right call for a large team wanting strict action logs and middleware. That is
  overkill for this scope.

### API

| Method | Path                                                               | Notes                                                                  |
| ------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| GET    | `/api/health`                                                      | Liveness                                                               |
| GET    | `/api/distributors`, `/api/distributors/:id`                       | 404 for unknown ids                                                    |
| GET    | `/api/retailers`, `/api/retailers/:id`, `/api/retailers/:id/sales` |                                                                        |
| GET    | `/api/sales`                                                       |                                                                        |
| POST   | `/api/sales`                                                       | Body: `{ retailerId, product, quantity, amount (cents), date? }`       |
| GET    | `/api/commissions/ledger`                                          | Derived from sales, onboardings and referrals, so it is always current |
| GET    | `/api/referrals`                                                   |                                                                        |

Every error has one shape, `{ status, message }`; internals are never leaked on a 500.

**`POST /api/sales` owns the money logic.** The client sends only the sale amount. The server checks the retailer
is eligible (not cancelled, deactivated, duplicate or invalid), rejects future-dated or pre-onboarding dates,
validates the body (unknown fields, including client-supplied commissions, are stripped), computes the
split with the same commission engine, assigns the next invoice number and returns `201`.

### How the frontend talks to it

The four service files are the whole contract with the backend, and `apiClient.ts` is the only code that calls
`fetch`. It normalises failures to an `ApiError` with a `status` (404 vs 5xx vs `0` for unreachable), which the
pages use to pick "not found" versus "try again". Moving to GraphQL or a different host means editing the
services, not the hooks, pages or domain code.

**Current split of responsibility.** The server creates records and builds the ledger. Dashboard KPIs, the state
filter and per-distributor summaries are still derived in the browser from the fetched datasets (the network
is small). At scale those aggregations would move behind server endpoints with server-side filtering.

### Database

**SQLite** (via `better-sqlite3`): one file, zero setup, real transactions and constraints, so `npm run dev`
still just works. Routes never see SQL; they use the `Store` interface in `server/store.ts`, so moving to
Postgres means re-implementing that one file.

Integrity is enforced **by the database**, not only by application code:

- `sales`: `CHECK (retailer + distributor + company + remainder = amount)`, so a sale can never lose or invent a cent;
  `amount` and `quantity` must be positive; `retailer_id` / `distributor_id` are foreign keys.
- `distributors`: `UNIQUE (parent_id, position)` makes the binary-tree rule ("one LEFT and one RIGHT child") a
  database invariant, and `CHECK ((parent_id IS NULL) = (position IS NULL))` ties placement to a side.
- Status and position columns are `CHECK`-constrained enums; money is `INTEGER` cents; indexes cover the
  retailer/distributor/date lookups.
- Creating a sale allocates the next invoice number and inserts inside **one transaction**, so numbers never
  collide or get skipped by a failed insert.
- WAL journal mode, so a hard kill loses nothing that was committed.

**Demo data and "today".** The seed is generated relative to today (onboardings today, 23:59 IST yesterday...).
So the database is re-seeded when it was seeded on an earlier business day, and kept otherwise: sales created through the
API survive restarts on the same day. Use `RESET_DB=1` to rebuild on demand. The ledger is not stored: it is
derived from sales, onboardings and referrals on every request, so it can never disagree with them.

## Business rules and decisions

**Money** is stored as integer cents everywhere. Floats are never used for currency.

**Commission engine.** `calculateCommission({ saleAmount, retailerPercentage, distributorPercentage, companyPercentage })`
returns retailer, distributor, company **and remainder**. The remainder (58% by default) is shown explicitly in the
sales table and retailer totals. Invariant, enforced by tests: `retailer + distributor + company + remainder === saleAmount`
to the cent. Invalid input (negative, fractional cents, percentages above 100 in total) throws.

**Same-day onboarding** is evaluated in the configured business time zone (`Asia/Kolkata`), not the viewer's
browser zone. Tests cover 23:59 IST vs 00:01 IST, where the UTC date differs from the IST date.
A retailer record is excluded (and the reason is recorded) when it is: for another distributor, has an invalid
date, is future-dated, predates the distributor's joining, is a duplicate (same id, or same phone under the same
distributor; the earliest wins), or is cancelled / deactivated.

**Binary tree.** Built from `parentId` + `position`. It supports several top-level distributors under the company.
Bad data is _reported, not hidden_: occupied slot, missing parent, missing position, or a parent cycle each produce
a visible data issue. Placement (`parentId`) and sponsorship (`referredBy`) are separate relationships.

**Downline commission** is attributed to the selling distributor's hierarchy: `traceSaleHierarchy()` returns the
chain from the top-most ancestor down to the seller, shown in the network side panel and the distributor page.

### Assumptions (the brief is ambiguous here)

1. **Onboarding bonus cap.** The brief says $50 "for each qualifying retailer", so the default is uncapped
   (`capBonusAtTarget: false`). It is one config flag away from "only up to the daily target".
2. **Onboarding bonus in the ledger.** Every qualifying onboarding earns $50 on the day it happened.
3. **Total commissions** = distributor (sales + onboarding) + retailer + referral + company downline.
4. **Total retailers** counts _active_ retailers only. Cancelled and deactivated ones remain visible on their pages.
5. **"Applicable distributor fee"** for referrals is modelled as a `fee` on each referral record (the data model in the brief
   has no fee field).
6. **State scoping** follows the distributor's state. Referrals scope by the _referring_ distributor.
7. In a state-filtered tree, a distributor whose parent is in another state becomes a root of that view.
8. Cancelled retailers generate no sales. Deactivated retailers keep their historical sales.

## Demo data edge cases

The seed plants cases so every rule is visible in the UI (see `server/seed.ts`):

| Distributor    | Case                                   | Expected                 |
| -------------- | -------------------------------------- | ------------------------ |
| DIST-001       | 2 onboardings today                    | 100% target, $100 bonus  |
| DIST-002       | Retailer onboarded 23:59 IST yesterday | Not counted today        |
| DIST-003       | 3 today + a cancelled + a duplicate    | 150%; 2 records excluded |
| DIST-004       | Retailer onboarded 00:01 IST today     | Counted today            |
| DIST-005       | Deactivated retailer                   | Excluded from bonus      |
| DIST-006 / 007 | Future-dated / pre-joining record      | Excluded as invalid      |

## Quality

- Strict TypeScript (`noUncheckedIndexedAccess`), oxlint, Prettier.
- **Tests:** domain unit tests (engine, onboarding rules, tree, seed integrity, metrics reconciliation) plus
  API tests (every endpoint, validation, 404/422/503 paths, server-side commission on `POST /api/sales`) and
  full-stack UI tests that render the real app across every route with `fetch` routed into the real Fastify app
  in-process (KPIs, state filter, tree, collapse/expand, search/filter, totals, 404s).
- Accessibility: keyboard-operable tree nodes, tooltips on focus, `aria-sort` on tables, status colours always paired
  with an icon and label, skip link, reduced-motion support, light and dark themes.
- Performance: route-level code splitting, memoized derivations, portal tooltips outside the zoomable canvas.

## What I'd do next

- Real REST/GraphQL backend plus auth and per-role visibility.
- Virtualize the tree and tables for networks with thousands of nodes; server-side pagination and filtering.
- Per-distributor and time-boxed commission rates (the engine already takes rates as input).
- Persist the state filter in the URL; add visual regression tests for the tree.
