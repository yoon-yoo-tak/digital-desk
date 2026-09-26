// Schema migrations, applied in order and tracked with PRAGMA user_version (ARCHITECTURE §4).

export const MIGRATIONS: readonly string[] = [
  // 001 — items, full-text index, settings
  `
  CREATE TABLE items (
    id               TEXT PRIMARY KEY,
    type             TEXT NOT NULL CHECK (type IN ('text','link','image','file','screenshot')),
    title            TEXT,
    text             TEXT,
    ocr_text         TEXT,
    file_path        TEXT,
    file_name        TEXT,
    url              TEXT,
    domain           TEXT,
    source_app       TEXT,
    source_bundle_id TEXT,
    created_at       INTEGER NOT NULL,
    captured_at      INTEGER NOT NULL,
    last_used_at     INTEGER NOT NULL,
    use_count        INTEGER NOT NULL DEFAULT 1,
    preview_path     TEXT,
    content_hash     TEXT,
    pinned           INTEGER NOT NULL DEFAULT 0,
    archived         INTEGER NOT NULL DEFAULT 0,
    ocr_status       TEXT CHECK (ocr_status IN ('pending','done','failed','skipped')),
    metadata_json    TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX items_last_used ON items(last_used_at DESC, id DESC);
  CREATE INDEX items_captured  ON items(captured_at);
  CREATE INDEX items_hash      ON items(content_hash);
  CREATE INDEX items_pinned    ON items(pinned) WHERE pinned = 1;

  CREATE VIRTUAL TABLE items_fts USING fts5(
    title, text, ocr_text, file_name, url, domain, source_app,
    tokenize = 'trigram case_sensitive 0'
  );

  CREATE TABLE settings (
    key        TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
  );
  `
]
