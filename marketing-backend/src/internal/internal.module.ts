import { Module }              from '@nestjs/common';
import { InternalApiKeyGuard } from './internal-api-key.guard.js';
import { InternalController }  from './internal.controller.js';

@Module({ controllers: [InternalController], providers: [InternalApiKeyGuard] })
export class InternalModule {}
