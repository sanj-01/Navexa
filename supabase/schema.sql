-- NAVEXA (ANVIL) schema — verbatim from ANVIL-SPEC.md §8
-- Apply against a Supabase project with the pgvector extension available.

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
