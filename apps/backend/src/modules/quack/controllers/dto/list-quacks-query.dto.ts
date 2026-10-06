import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export const QUACK_SEARCH_MAX_LENGTH = 100;

export class ListQuacksQueryDto {
  @ApiPropertyOptional({
    description:
      'Return only quacks whose text, author name or author username contains this text (case-insensitive). Omit it for the full feed.',
    example: 'duck',
    maxLength: QUACK_SEARCH_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(QUACK_SEARCH_MAX_LENGTH)
  // Whitespace-only input is the same as no search; the service drops it.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;
}
