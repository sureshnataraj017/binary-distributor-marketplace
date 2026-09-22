-- Initial schema. Money is INTEGER cents (SQLite integers are 64-bit); instants are TEXT ISO-8601
-- (stored in UTC). IDs are readable strings (DIST-001, RET-1001, INV-1001, REF-0001) assigned by
-- the application from the `counters` table inside the same transaction as the insert, so records
-- can be created one at a time without ever colliding within this single-process server.

CREATE TABLE counters (
  name   TEXT PRIMARY KEY,
  value  INTEGER NOT NULL
);
INSERT INTO counters (name, value) VALUES
  ('distributor', 0), ('retailer', 1000), ('sale_invoice', 1000), ('referral', 0);

CREATE TABLE distributors (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL CHECK (length(trim(name)) > 0),
  state         TEXT NOT NULL,
  city          TEXT NOT NULL,
  parent_id     TEXT REFERENCES distributors(id),
  position      TEXT CHECK (position IN ('LEFT', 'RIGHT')),
  referred_by   TEXT REFERENCES distributors(id),
  daily_target  INTEGER NOT NULL CHECK (daily_target >= 0),
  joined_at     TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- a placed distributor needs a side; a top-level one must not have one
  CHECK ((parent_id IS NULL) = (position IS NULL)),
  CHECK (parent_id IS NULL OR parent_id <> id),
  CHECK (referred_by IS NULL OR referred_by <> id),
  -- a slot holds one child: the binary-tree rule, enforced by the database itself
  UNIQUE (parent_id, position)
);
CREATE INDEX idx_distributors_state ON distributors(state);

CREATE TABLE retailers (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL CHECK (length(trim(name)) > 0),
  distributor_id  TEXT NOT NULL REFERENCES distributors(id),
  state           TEXT NOT NULL,
  city            TEXT NOT NULL,
  phone           TEXT,
  onboarded_at    TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('ACTIVE', 'DEACTIVATED', 'CANCELLED')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_retailers_distributor ON retailers(distributor_id);

CREATE TABLE sales (
  id                      TEXT PRIMARY KEY,
  invoice_no              INTEGER NOT NULL UNIQUE,
  retailer_id             TEXT NOT NULL REFERENCES retailers(id),
  distributor_id          TEXT NOT NULL REFERENCES distributors(id),
  date                    TEXT NOT NULL,
  product                 TEXT NOT NULL CHECK (length(trim(product)) > 0),
  quantity                INTEGER NOT NULL CHECK (quantity > 0),
  amount                  INTEGER NOT NULL CHECK (amount > 0),
  retailer_commission     INTEGER NOT NULL CHECK (retailer_commission >= 0),
  distributor_commission  INTEGER NOT NULL CHECK (distributor_commission >= 0),
  company_commission      INTEGER NOT NULL CHECK (company_commission >= 0),
  remainder               INTEGER NOT NULL CHECK (remainder >= 0),
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- nothing may be lost: the four shares always add back up to the sale, to the cent
  CHECK (retailer_commission + distributor_commission + company_commission + remainder = amount)
);
CREATE INDEX idx_sales_retailer ON sales(retailer_id);
CREATE INDEX idx_sales_distributor ON sales(distributor_id);
CREATE INDEX idx_sales_date ON sales(date);

CREATE TABLE referrals (
  id                        TEXT PRIMARY KEY,
  referring_distributor_id  TEXT NOT NULL REFERENCES distributors(id),
  referred_distributor_id   TEXT NOT NULL REFERENCES distributors(id),
  date                      TEXT NOT NULL,
  fee                       INTEGER NOT NULL CHECK (fee >= 0),
  percentage                REAL NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  commission                INTEGER NOT NULL CHECK (commission >= 0),
  payment_status            TEXT NOT NULL CHECK (payment_status IN ('PENDING', 'PAID')),
  created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (referring_distributor_id <> referred_distributor_id)
);
CREATE INDEX idx_referrals_referring ON referrals(referring_distributor_id);
