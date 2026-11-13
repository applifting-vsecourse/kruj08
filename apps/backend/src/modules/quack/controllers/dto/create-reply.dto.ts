import { QUACK_MOODS, QuackMood } from '@/modules/quack/domain/quack';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// A reply is a quack without a poll, so this is CreateQuackDto minus `poll`.
// The controller's ValidationPipe forbids unknown properties, so a poll sent
// along is refused with 400 rather than quietly dropped.
export class CreateReplyDto {
  @ApiProperty({
    description: 'Body of the reply. Same limit as a quack.',
    example: 'Was it at least good bread?',
    maxLength: 280,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  text!: string;

  @ApiPropertyOptional({
    description: 'Mood of the reply. Omit it for a plain reply.',
    enum: QUACK_MOODS,
    example: 'happy',
  })
  @IsOptional()
  @IsIn(QUACK_MOODS)
  mood?: QuackMood;
}
