// src/assignment/assignment.module.ts
import { Module } from '@nestjs/common';
import { AssignmentService } from '@/assignment/assignment.service.js';

@Module({
  providers: [AssignmentService],
  exports: [AssignmentService],
})
export class AssignmentModule {}
