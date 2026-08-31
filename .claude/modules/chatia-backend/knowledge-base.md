# Modulo: Knowledge Base + RAG (chatia-backend)

## Que hace en palabras simples

Es la "memoria" del agente IA. El dueno del negocio sube documentos
(PDFs, texto, URLs) y el sistema los procesa para que la IA pueda
responder preguntas basandose en ese contenido especifico.

Ejemplo: subes el manual de tu producto → el agente IA puede responder
preguntas de clientes usando ese manual como referencia.

## Como funciona

### Ingestión de documentos
1. `POST /faq/documents` — el usuario sube un documento
2. `FaqIngestionService` encola el trabajo
3. `FaqIngestionProcessor` (BullMQ) o `workers-backend/FaqIngestProcessor`:
   - Divide el texto en fragmentos (chunks)
   - Genera embeddings via `EmbeddingService` (usa Groq hoy, pgvector en S4)
   - Guarda fragmentos + embeddings en DB
4. El documento pasa a estado INDEXED

### Consulta RAG (Retrieval-Augmented Generation)
1. El agente IA recibe un mensaje de baja confianza
2. `FaqQueryService.query(text, kbId)`:
   - Genera embedding del texto de la pregunta
   - Busca los K fragmentos mas similares (cosine similarity)
   - Los fragmentos se inyectan como contexto al prompt de Groq
3. Groq genera una respuesta fundamentada en los documentos

## Entidades clave

- `KnowledgeBase` — coleccion de documentos por proyecto
- `KbDocument` — documento fuente (estado: PENDING→PROCESSING→INDEXED/FAILED)
- `KbChunk` — fragmento indexado con su embedding guardado

## Estado actual

OK — RAG funcional con Groq embeddings.
Pendiente: migrar a pgvector + OpenAI text-embedding-3-small (S4) para
mayor precision y escalabilidad.
