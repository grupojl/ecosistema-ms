import { Module }                       from '@nestjs/common';
import { AttributeConversionProcessor } from '@/attribution/processors/attribute-conversion.processor.js';
@Module({ providers: [AttributeConversionProcessor] })
export class AttributionModule {}
