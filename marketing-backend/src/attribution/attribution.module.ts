import { Module }                       from '@nestjs/common';
import { AttributeConversionProcessor } from './processors/attribute-conversion.processor.js';
@Module({ providers: [AttributeConversionProcessor] })
export class AttributionModule {}
