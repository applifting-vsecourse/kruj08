import { Profile } from '@/modules/profile/domain/profile';
import { QUACK_MOODS, QuackMood } from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';

export class ProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Display name shown next to quacks' })
  name!: string;

  @ApiProperty({ description: 'Handle shown with an "@"' })
  username!: string;

  @ApiProperty({ type: String, nullable: true })
  bio!: string | null;

  @ApiProperty({
    description: 'Mood preselected on the new-quack form, or null.',
    enum: QUACK_MOODS,
    nullable: true,
  })
  defaultMood!: QuackMood | null;

  static fromDomain(profile: Profile): ProfileResponseDto {
    return {
      id: profile.id,
      name: profile.name,
      username: profile.username,
      bio: profile.bio,
      defaultMood: profile.defaultMood,
    };
  }
}
