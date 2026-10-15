-- KbChunk: búsqueda vectorial real con pgvector.
--
-- Hasta ahora los vectores vivían en KbChunk.embedding (Json) y la búsqueda comparaba TODOS los
-- fragmentos de la base de conocimiento en memoria. Esta migración agrega:
--   · "embeddingVec"   vector(1024)  — dimensión de BAAI/bge-m3 (modelo por defecto, ver EMBEDDINGS_MODEL)
--   · "embeddingModel" text          — con qué modelo se generó cada vector (para migrar/reindexar sin ciegas)
--   · índice HNSW por similitud coseno
--
-- SEGURA SI NO HAY pgvector: si la extensión no está disponible en el Postgres (algunos planes de Railway),
-- la migración NO falla (no bloquea el deploy): deja un aviso y la app sigue con búsqueda en memoria / por texto.
-- Para habilitarla después: instalar la extensión y volver a correr este bloque a mano.

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector no disponible (%): se omite la columna vectorial', SQLERRM;
END
$$;

-- El modelo con el que se generó cada vector no depende de pgvector
ALTER TABLE "KbChunk" ADD COLUMN IF NOT EXISTS "embeddingModel" TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    ALTER TABLE "KbChunk" ADD COLUMN IF NOT EXISTS "embeddingVec" vector(1024);
    CREATE INDEX IF NOT EXISTS "KbChunk_embeddingVec_hnsw_idx"
      ON "KbChunk" USING hnsw ("embeddingVec" vector_cosine_ops);
  END IF;
END
$$;
