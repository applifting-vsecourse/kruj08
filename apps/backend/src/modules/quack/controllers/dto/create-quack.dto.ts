import { QUACK_MOODS, QuackMood } from '@/modules/quack/domain/quack';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

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
}
