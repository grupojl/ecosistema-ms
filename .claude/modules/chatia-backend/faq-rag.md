# Módulo: faq (Knowledge Base + RAG) — chatia-backend

## Responsabilidad
Knowledge Base por proyecto: ingestión de documentos, indexación vectorial y
query RAG para respuestas del agente IA.

## Flujo de ingestión
```
POST /faq/documents
  → FaqIngestionService.enqueue()
  → BullMQ queue: faq-ingestion
  → FaqIngestionProcessor (chatia) o workers-backend/FaqIngestProcessor
  → chunking + embedding
  → persistir en vector store
```

## Flujo de query RAG
```
Assistant recibe mensaje
  → FaqQueryService.query(text, projectId)
  → embedding del texto
  → similarity search en vector store
  → top-K chunks como contexto
  → Groq LLM genera respuesta
```

## Entidades
- `KnowledgeBase` — colección por proyecto
- `KbDocument` — documento fuente
- `KbChunk` — fragmento indexado con embedding

## Invariantes
- Una KnowledgeBase pertenece a exactamente un proyecto
- Los embeddings se generan via `EmbeddingService` (centralizado en common/)
- Re-ingestión de un documento con mismo hash = skip (idempotente)
