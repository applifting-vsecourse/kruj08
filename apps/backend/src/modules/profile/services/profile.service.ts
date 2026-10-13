import {
  Profile,
  ProfileChanges,
  UsernameTakenError,
} from '@/modules/profile/domain/profile';
import { ProfileRepository } from '@/modules/profile/repositories/profile.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Injectable } from '@nestjs/common';

// "No bio" has one representation in the database: null, never "".
const normalizeBio = (bio: string | null): string | null => {
  const trimmed = bio?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
};

@Injectable()
export class ProfileService {
  constructor(private readonly profileRepository: ProfileRepository) {}

  async getProfile(user: Identity): Promise<Profile | null> {
    return this.profileRepository.findByUserId(user.id);
  }

  async updateProfile(
    user: Identity,
    changes: ProfileChanges,
  ): Promise<Profile> {
    if (changes.username !== undefined) {
      const isTaken = await this.profileRepository.isUsernameTaken(
        changes.username,
        user.id,
      );
      if (isTaken) {
        throw new UsernameTakenError(changes.username);
      }
    }

    return this.profileRepository.updateProfile(user.id, {
      ...changes,
      bio: changes.bio === undefined ? undefined : normalizeBio(changes.bio),
    });
  }
}
