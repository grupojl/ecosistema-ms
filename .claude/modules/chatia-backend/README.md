# chatia-backend — Panel de módulos

## ¿Qué es?

El servicio de Chat IA del ecosistema. Gestiona todo el ciclo de vida de
las conversaciones entre clientes finales y los agentes IA de cada organización.
También maneja la Knowledge Base (FAQ + RAG), los canales de comunicación
(WhatsApp, etc.) y los proyectos de chat.

## ¿A quién sirve?

- A los ecosistemas clientes (welver, manzana, mexus) via gRPC
- A los dashboards de colaboradores via HTTP REST (aunque idealmente via gRPC)
- A los clientes finales via widget (HTTP público)

## Módulos disponibles

| Módulo | Archivo | Estado |
|--------|---------|--------|
| Conversaciones | [conversations.md](conversations.md) | ⚠️ Sin Domain/Repo |
| FAQ/Knowledge Base | [faq.md](faq.md) | ⚠️ Sin Domain/Repo |
| Canales | [channels.md](channels.md) | 🟡 Interface definida |
| Agentes | [agents.md](agents.md) | ⚠️ Sin Domain/Repo |
