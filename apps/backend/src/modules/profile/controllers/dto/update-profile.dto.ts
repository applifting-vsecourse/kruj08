import {
  BIO_MAX_LENGTH,
  NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from '@/modules/profile/domain/profile';
import { QUACK_MOODS, QuackMood } from '@/modules/quack/domain/quack';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

// Whitespace around a value is never meaningful here, so it is dropped before
// validation — "   " is an empty name, not a one-character one.
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// Every field is optional: the client sends what changed. A field set to null
// clears it (bio, defaultMood); a field left out is not touched.
export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Display name shown next to quacks',
    example: 'Caffeinated Duck',
    minLength: 1,
    maxLength: NAME_MAX_LENGTH,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({
    description:
      'Handle shown with an "@". Letters, digits, dots and underscores only.',
    example: 'caffeinated.duck',
    minLength: USERNAME_MIN_LENGTH,
    maxLength: USERNAME_MAX_LENGTH,
    pattern: USERNAME_PATTERN.source,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, {
    message: `Username must be ${USERNAME_MIN_LENGTH} to ${USERNAME_MAX_LENGTH} characters long`,
  })
  @Matches(USERNAME_PATTERN, {
    message: 'Username may contain only letters, digits, dots and underscores',
  })
  username?: string;

  @ApiPropertyOptional({
    description: 'Short bio. Send null or an empty string to clear it.',
    example: 'Quacks mostly about coffee.',
    maxLength: BIO_MAX_LENGTH,
    nullable: true,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(BIO_MAX_LENGTH)
  bio?: string | null;

  @ApiPropertyOptional({
    description:
      'Mood preselected on the new-quack form. Send null for no default.',
    enum: QUACK_MOODS,
    example: 'happy',
    nullable: true,
  })
  @IsOptional()
  @IsIn(QUACK_MOODS)
  defaultMood?: QuackMood | null;
}
