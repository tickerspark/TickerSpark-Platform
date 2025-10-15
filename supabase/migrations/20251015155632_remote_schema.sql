create extension if not exists "vector" with schema "extensions";


create sequence "public"."intelligent_documents_id_seq";

create table "public"."intelligent_documents" (
    "id" bigint not null default nextval('intelligent_documents_id_seq'::regclass),
    "content" text not null,
    "embedding" extensions.vector(1536),
    "document_type" text not null,
    "source" document_source,
    "metadata" jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "owner_id" uuid,
    "published_at" timestamp with time zone
);


alter table "public"."intelligent_documents" enable row level security;

alter sequence "public"."intelligent_documents_id_seq" owned by "public"."intelligent_documents"."id";

CREATE INDEX idx_published_at ON public.intelligent_documents USING btree (published_at);

CREATE INDEX intelligent_documents_embedding_idx ON public.intelligent_documents USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists='40');

CREATE INDEX intelligent_documents_embedding_idx1 ON public.intelligent_documents USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists='100');

CREATE INDEX intelligent_documents_embedding_idx2 ON public.intelligent_documents USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists='100');

CREATE UNIQUE INDEX intelligent_documents_pkey ON public.intelligent_documents USING btree (id);

alter table "public"."intelligent_documents" add constraint "intelligent_documents_pkey" PRIMARY KEY using index "intelligent_documents_pkey";

alter table "public"."intelligent_documents" add constraint "intelligent_documents_document_type_check" CHECK ((document_type = ANY (ARRAY['market_report'::text, 'compliance_doc'::text, 'chat_message'::text, 'user_note'::text, 'external_article'::text]))) not valid;

alter table "public"."intelligent_documents" validate constraint "intelligent_documents_document_type_check";

alter table "public"."intelligent_documents" add constraint "intelligent_documents_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) not valid;

alter table "public"."intelligent_documents" validate constraint "intelligent_documents_owner_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.backfill_publication_date(p_source_id text, p_new_date timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE intelligent_documents
    SET
        published_at = p_new_date,
        metadata = metadata || jsonb_build_object('publicationDate', p_new_date)
    -- The WHERE clause now correctly accesses the second field of the composite type.
    WHERE (source).source_id = p_source_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_documents_by_source_id(p_source_id text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  deleted_count BIGINT;
BEGIN
  WITH deleted_rows AS (
    DELETE FROM public.intelligent_documents
    WHERE (source).source_id = p_source_id
    RETURNING id -- The RETURNING clause is what allows us to count the deleted rows
  )
  SELECT count(*)
  INTO deleted_count
  FROM deleted_rows;

  RETURN deleted_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_multiple_documents_by_source_id(p_source_ids text[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM intelligent_documents
    WHERE (source->>'source_id') = ANY(p_source_ids)
    RETURNING *
  )
  SELECT count(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$function$
;

create type "public"."document_source" as ("source_type" text, "source_id" text);

CREATE OR REPLACE FUNCTION public.enqueue_embedding_job()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Check if the embedding is NULL OR if it's a zero-vector
  IF NEW.embedding IS NULL OR NEW.embedding = array_fill(0, ARRAY[1536])::vector THEN
    PERFORM pgmq.send(
      'embedding_jobs',
      jsonb_build_object('document_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.match_documents(query_embedding extensions.vector, match_threshold double precision, match_count integer, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_content_type text DEFAULT NULL::text)
 RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- The problematic SET LOCAL line has been removed.
  RETURN QUERY
  SELECT
    idoc.id,
    idoc.content,
    idoc.metadata,
    1 - (idoc.embedding <=> query_embedding) AS similarity
  FROM
    intelligent_documents AS idoc
  WHERE
    1 - (idoc.embedding <=> query_embedding) > match_threshold
    AND (p_start_date IS NULL OR idoc.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR idoc.created_at::date <= p_end_date)
    AND (p_content_type IS NULL OR (idoc.metadata->>'content_type_id') = p_content_type)
  ORDER BY
    idoc.embedding <=> query_embedding
  LIMIT
    match_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rebuild_ivfflat_index()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  row_count BIGINT;
  list_count INT;
  index_name TEXT;
BEGIN
  -- 1. Get the current number of rows
  SELECT count(*) INTO row_count FROM public.intelligent_documents;

  -- 2. NEW, ACCURACY-FOCUSED FORMULA:
  -- This creates fewer, larger lists to prioritize search accuracy (recall).
  list_count := GREATEST(10, LEAST(200, floor(row_count / 500)::INT));

  -- 3. Find the name of the existing ivfflat index
  SELECT i.relname INTO index_name
  FROM pg_class t
  JOIN pg_index ix ON t.oid = ix.indrelid
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_am am ON i.relam = am.oid
  WHERE t.relname = 'intelligent_documents' AND am.amname = 'ivfflat';

  -- 4. If an index exists, drop it
  IF index_name IS NOT NULL THEN
    RAISE NOTICE 'Dropping existing index %', index_name;
    EXECUTE 'DROP INDEX IF EXISTS public.' || quote_ident(index_name);
  END IF;

  -- 5. Create the new, optimized index using the accuracy-focused formula
  RAISE NOTICE 'Creating new accuracy-tuned index with lists = %', list_count;
  EXECUTE 'CREATE INDEX ON public.intelligent_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = ' || list_count || ')';

  RETURN 'Successfully rebuilt accuracy-tuned ivfflat index with lists = ' || list_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.requeue_null_embeddings()
 RETURNS bigint
 LANGUAGE plpgsql
AS $function$
DECLARE
  jobs_created_count BIGINT;
BEGIN
  -- This is the same logic as your script, but wrapped in a function
  -- which ensures the transaction is committed correctly.
  WITH jobs AS (
    SELECT pgmq.send(
      'embedding_jobs',
      jsonb_build_object('document_id', id)
    )
    FROM public.intelligent_documents
    WHERE embedding IS NULL
  )
  SELECT count(*) INTO jobs_created_count FROM jobs;

  RETURN jobs_created_count;
END;
$function$
;

create policy "Allow service roles full access"
on "public"."intelligent_documents"
as permissive
for all
to public
using (true)
with check (true);


create policy "Users can only access their own documents"
on "public"."intelligent_documents"
as permissive
for select
to public
using ((auth.uid() = owner_id));


CREATE TRIGGER on_intelligent_documents_update BEFORE UPDATE ON public.intelligent_documents FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trigger_enqueue_embedding_job AFTER INSERT ON public.intelligent_documents FOR EACH ROW EXECUTE FUNCTION enqueue_embedding_job();



