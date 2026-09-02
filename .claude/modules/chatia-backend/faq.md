# Módulo: faq (Knowledge Base + RAG)

## ¿Qué hace?

Gestiona la base de conocimiento de cada organización:
documentos, ingestión, embeddings y consulta RAG.

## Subcarpetas

- `document/` — CRUD de documentos KB
- `ingestion/` — processor BullMQ para generar embeddings (Groq/LangGraph)
- `knowledge-base/` — gestión de la KB como entidad
- `query/` — consulta RAG (retrieve + generate)
- `rag/` — lógica de retrieval augmented generation

## Estado actual

⚠️ Sin Domain/Repository. EmbeddingService vive en `common/services/` (BLOQUEANTE).
La lógica de RAG es la más compleja del servicio — migrar después del MOLDE VIVO.
