import { DELETION_REASON_MAX_LENGTH } from '@/modules/quack/domain/quack';
import { MaxCharacters } from '@/shared/validation/max-characters.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class DeleteQuackDto {
  @ApiPropertyOptional({
    description:
      'Why the quack is deleted. Required from an admin, on every quack including their own; ignored for an author deleting their own quack. Kept on record and shown to nobody, the author included.',
    example: 'Sells duckweed tea as a cure for molting.',
    maxLength: DELETION_REASON_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  // Trim before measuring, so surrounding whitespace doesn't count towards
  // the limit and "   " reaches the service as no reason at all.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  // Counted like the VARCHAR(500) column it is stored in, so a reason that
  // passes here always fits there.
  @MaxCharacters(DELETION_REASON_MAX_LENGTH)
  reason?: string;
}
