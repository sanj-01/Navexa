-- match_chunks: pgvector cosine top-N with attributes_hint pre-filter.
-- ANVIL-SPEC.md §7 step 1.
--
-- Apply this against the same database as supabase/schema.sql.

create or replace function match_chunks(
  query_embedding vector(1024),
  match_count int,
  match_attributes text[]
)
returns table (
  chunk_id        text,
  doc_id          text,
  title           text,
  breadcrumb      text,
  text            text,
  locator         text,
  attributes_hint text[],
  score           real
)
language sql stable as $$
  select
    c.chunk_id,
    c.doc_id,
    c.title,
    c.breadcrumb,
    c.text,
    c.locator,
    c.attributes_hint,
    (1 - (c.embedding <=> query_embedding))::real as score
  from chunks c
  where
    -- Pre-filter: rule of §7 step 1. Null hints are always eligible.
    c.attributes_hint is null
    or c.attributes_hint && match_attributes
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
