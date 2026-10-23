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

  @ApiProperty({
    description:
      'Whether the signed-in user may see the counts: true once they have voted, and always for the author of the quack.',
  })
  canSeeResults!: boolean;

  static fromDomain(poll: Poll, viewer: { isAuthor: boolean }): PollDto {
    return {
      options: poll.options.map(({ id, text, votes }) => ({ id, text, votes })),
      totalVotes: poll.totalVotes,
      myOptionId: poll.myOptionId,
      // The author asked the question, so they get the answers without having
      // to pick one themselves. Everyone else votes first.
      canSeeResults: viewer.isAuthor || poll.myOptionId !== null,
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

  @ApiProperty({
    description:
      'Whether the signed-in user may delete this quack: true only for its author. The admin role gets no exception.',
  })
  canDelete!: boolean;

  // `viewerId` is the signed-in user: it decides whether the poll's counts are
  // visible to them (see PollDto.fromDomain) and whether they may delete the
  // quack. The client only displays both, it never works them out itself.
  static fromDomain(quack: Quack, viewerId: string): QuackResponseDto {
    if (!quack.user) {
      throw new Error(
        `QuackResponseDto.fromDomain expected quack.user to be loaded for quack ${quack.id}`,
      );
    }
    const isAuthor = quack.userId === viewerId;
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
      poll: quack.poll ? PollDto.fromDomain(quack.poll, { isAuthor }) : null,
      canDelete: isAuthor,
    };
  }
}
