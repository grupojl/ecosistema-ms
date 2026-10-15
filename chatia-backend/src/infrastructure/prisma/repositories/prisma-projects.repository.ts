// chatia-backend/src/infrastructure/prisma/repositories/prisma-projects.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import type { Project } from '@/generated/prisma/client.js';
import type {
  CreateProjectData,
  IProjectsRepository,
  ProjectDetail,
  ProjectListItem,
  ProjectWithConfigs,
  PublicProject,
  UpdateProjectData,
} from '@/core/projects/repository/projects.repository.interface.js';

@Injectable()
export class PrismaProjectsRepository implements IProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private bySlug(organizationId: string, slug: string) {
    return { organizationId_slug: { organizationId, slug } };
  }

  findBySlug(organizationId: string, slug: string): Promise<Project | null> {
    return this.prisma.project.findUnique({
      where: this.bySlug(organizationId, slug),
    });
  }

  findDetailedBySlug(
    organizationId: string,
    slug: string,
  ): Promise<ProjectDetail | null> {
    return this.prisma.project.findUnique({
      where: this.bySlug(organizationId, slug),
      include: {
        assistantConfigs: {
          select: {
            id: true,
            personaName: true,
            isEnabled: true,
            groqModel: true,
          },
        },
        knowledgeBases: {
          select: { id: true, name: true, isActive: true },
          where: { isActive: true },
        },
      },
    });
  }

  findByIdInOrganization(
    id: string,
    organizationId: string,
  ): Promise<Project | null> {
    return this.prisma.project.findFirst({ where: { id, organizationId } });
  }

  listWithCounts(organizationId: string): Promise<ProjectListItem[]> {
    return this.prisma.project.findMany({
      where: { organizationId },
      include: {
        _count: { select: { assistantConfigs: true, knowledgeBases: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: CreateProjectData): Promise<Project> {
    return this.prisma.project.create({ data });
  }

  update(
    organizationId: string,
    slug: string,
    data: UpdateProjectData,
  ): Promise<Project> {
    return this.prisma.project.update({
      where: this.bySlug(organizationId, slug),
      data,
    });
  }

  async remove(organizationId: string, slug: string): Promise<void> {
    await this.prisma.project.delete({
      where: this.bySlug(organizationId, slug),
    });
  }

  findBySlugWithConfigs(
    organizationId: string,
    slug: string,
  ): Promise<ProjectWithConfigs | null> {
    return this.prisma.project.findUnique({
      where: this.bySlug(organizationId, slug),
      include: { assistantConfigs: true },
    });
  }

  findDefaultActiveWithConfigs(
    organizationId: string,
  ): Promise<ProjectWithConfigs | null> {
    return this.prisma.project.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: 'asc' },
      include: { assistantConfigs: true },
    });
  }

  upsertBySlug(
    organizationId: string,
    slug: string,
    name: string,
  ): Promise<Project> {
    // upsert: tolera dos primeros chats concurrentes de la misma org
    return this.prisma.project.upsert({
      where: this.bySlug(organizationId, slug),
      update: {},
      create: { organizationId, slug, name },
    });
  }

  findActiveBySlugForWidget(
    slug: string,
    organizationId?: string,
  ): Promise<PublicProject[]> {
    return this.prisma.project.findMany({
      where: {
        slug,
        isActive: true,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        assistantConfigs: true,
        organization: { select: { ecosystemId: true } },
      },
      take: 2,
    });
  }
}
