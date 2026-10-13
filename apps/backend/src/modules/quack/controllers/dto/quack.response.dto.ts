import {
  Poll,
  Quack,
  QUACK_MOODS,
  QuackMood,
} from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';

class QuackUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  username!: string;
}

export class PollOptionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty({ description: 'Number of votes this option has received.' })
  votes!: number;
}

export class PollDto {
  @ApiProperty({ type: [PollOptionDto], description: 'In author order.' })
  options!: PollOptionDto[];

  @ApiProperty({ description: 'Sum of votes across all options.' })
  totalVotes!: number;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      "Id of the option the signed-in user voted for, or null if they haven't voted.",
  })
  myOptionId!: string | null;

  static fromDomain(poll: Poll): PollDto {
    return {
      options: poll.options.map(({ id, text, votes }) => ({ id, text, votes })),
      totalVotes: poll.totalVotes,
      myOptionId: poll.myOptionId,
    };
  }
}

export class QuackResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty({
    description: 'Mood of the quack, or null for a plain post.',
    enum: QUACK_MOODS,
    nullable: true,
  })
  mood!: QuackMood | null;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: QuackUserDto })
  user!: QuackUserDto;

  @ApiProperty({
    type: PollDto,
    nullable: true,
    description: 'The attached poll, or null for a plain post.',
  })
  poll!: PollDto | null;

  static fromDomain(quack: Quack): QuackResponseDto {
    if (!quack.user) {
      throw new Error(
        `QuackResponseDto.fromDomain expected quack.user to be loaded for quack ${quack.id}`,
      );
    }
    return {
      id: quack.id,
      text: quack.text,
      mood: quack.mood,
      userId: quack.userId,
      createdAt: quack.createdAt,
      user: {
        id: quack.user.id,
        name: quack.user.name,
        username: quack.user.username,
      },
      poll: quack.poll ? PollDto.fromDomain(quack.poll) : null,
    };
  }
}
