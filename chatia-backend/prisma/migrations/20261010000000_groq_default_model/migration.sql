-- Default de modelo Groq: openai/gpt-oss-120b (los modelos Llama ya no están disponibles).
-- Solo cambia el DEFAULT de la columna; las filas existentes no se modifican.
ALTER TABLE "AiConfig"        ALTER COLUMN "groqModel" SET DEFAULT 'openai/gpt-oss-120b';
ALTER TABLE "AssistantConfig" ALTER COLUMN "groqModel" SET DEFAULT 'openai/gpt-oss-120b';
