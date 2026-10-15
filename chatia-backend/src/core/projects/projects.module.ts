// src/core/projects/projects.module.ts
import { Module } from '@nestjs/common';
import { ProjectsService } from '@/core/projects/projects.service.js';

@Module({
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
