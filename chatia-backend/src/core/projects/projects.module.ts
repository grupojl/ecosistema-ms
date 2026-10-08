// src/projects/projects.module.ts
import { Module } from '@nestjs/common';
import { ProjectsController } from '@/core/projects/projects.controller.js';
import { ProjectsService } from '@/core/projects/projects.service.js';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
