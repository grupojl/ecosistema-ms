// analytics-backend/src/core/index.ts
// Contrato público del core — lo que los modules pueden consumir
// Internals (processors, repositories) no se exportan desde aquí

export { OverviewService }    from "@/core/overview/overview.service.js";
export { ExportService }      from "@/core/export/export.service.js";
export { ProjectionsService } from "@/core/projections/projections.service.js";
export * from "@/core/analytics.constants.js";

// Módulos para importar en otros modules
export { OverviewModule }     from "@/core/overview/overview.module.js";
export { AgentsModule }       from "@/core/agents/agents.module.js";
export { EventsModule }       from "@/core/events/events.module.js";
export { ProjectionsModule }  from "@/core/projections/projections.module.js";
export { ExportModule }       from "@/core/export/export.module.js";
