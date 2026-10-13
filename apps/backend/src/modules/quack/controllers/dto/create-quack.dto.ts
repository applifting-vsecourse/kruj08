import {
  POLL_OPTION_MAX_LENGTH,
  POLL_OPTIONS_MAX,
  POLL_OPTIONS_MIN,
  QUACK_MOODS,
  QuackMood,
} from '@/modules/quack/domain/quack';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreatePollDto {
  @ApiProperty({
    description: `Between ${POLL_OPTIONS_MIN} and ${POLL_OPTIONS_MAX} answers, each up to ${POLL_OPTION_MAX_LENGTH} characters and different from the others. The quack's text is the question.`,
    example: ['Pizza', 'Sushi', 'Burger'],
    minItems: POLL_OPTIONS_MIN,
    maxItems: POLL_OPTIONS_MAX,
  })
  @IsArray()
  @ArrayMinSize(POLL_OPTIONS_MIN)
  @ArrayMaxSize(POLL_OPTIONS_MAX)
  @IsString({ each: true })
  // Trim before measuring, so "   " fails the minimum rather than passing it.
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((item: unknown) =>
          typeof item === 'string' ? item.trim() : item,
        )
      : value,
  )
  @Length(1, POLL_OPTION_MAX_LENGTH, { each: true })
  options!: string[];
}

export class CreateQuackDto {
  @ApiProperty({
    description: 'Body of the quack',
    example: 'Hello, world!',
    maxLength: 280,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  text!: string;

  @ApiPropertyOptional({
    description: 'Mood of the quack. Omit it for a plain post.',
    enum: QUACK_MOODS,
    example: 'silly',
  })
  @IsOptional()
  @IsIn(QUACK_MOODS)
  mood?: QuackMood;

  @ApiPropertyOptional({
    description: 'Attach a poll. Omit it for a plain post.',
    type: CreatePollDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePollDto)
  poll?: CreatePollDto;
}
