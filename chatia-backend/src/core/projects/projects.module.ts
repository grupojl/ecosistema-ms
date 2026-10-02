// src/projects/projects.module.ts
import { Module } from '@nestjs/common';
import { ProjectsController } from '@/projects/projects.controller.js';
import { ProjectsService } from '@/projects/projects.service.js';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
