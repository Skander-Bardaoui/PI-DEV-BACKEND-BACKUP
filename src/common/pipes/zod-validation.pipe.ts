import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodType<any>) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
  const errors = (result as any).error?.errors?.map((e: any) => ({
    field: e.path.join('.'),
    message: e.message,
  })) || [{ field: 'body', message: 'Invalid request body' }];

  throw new BadRequestException(errors);
}
    return result.data;
  }
}
