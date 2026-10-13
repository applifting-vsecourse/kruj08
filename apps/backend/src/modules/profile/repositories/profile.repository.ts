import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma, User as PrismaUser } from '@/generated/prisma/client';
import {
  Profile,
  ProfileChanges,
  UsernameTakenError,
} from '@/modules/profile/domain/profile';
import { Injectable } from '@nestjs/common';

// BetterAuth's username plugin keeps the handle twice: `username` lowercased
// (unique, used for sign-in) and `displayUsername` as typed. The domain only
// knows the typed form; this mapping is where the two meet.
const mapPrismaUserToProfile = (user: PrismaUser): Profile => ({
  id: user.id,
  name: user.name,
  username: user.displayUsername ?? user.username ?? '',
  bio: user.bio,
  defaultMood: user.defaultMood,
});

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

@Injectable()
export class ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<Profile | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? mapPrismaUserToProfile(user) : null;
  }

  /**
   * Case-insensitive on purpose: "Duck" and "duck" would be two accounts
   * nobody can tell apart. The caller's own row is excluded so keeping the
   * current handle (or only changing its case) is not a conflict.
   */
  async isUsernameTaken(
    username: string,
    excludingUserId: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
        NOT: { id: excludingUserId },
      },
      select: { id: true },
    });
    return user !== null;
  }

  async updateProfile(
    userId: string,
    changes: ProfileChanges,
  ): Promise<Profile> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          name: changes.name,
          ...(changes.username !== undefined
            ? {
                username: changes.username.toLowerCase(),
                displayUsername: changes.username,
              }
            : {}),
          bio: changes.bio,
          defaultMood: changes.defaultMood,
          // BetterAuth manages this column, so Prisma's @updatedAt is not on it.
          updatedAt: new Date(),
        },
      });
      return mapPrismaUserToProfile(user);
    } catch (error) {
      // Two people picking the same handle at the same moment get past the
      // service's check; the unique index does not let the second one through.
      if (isUniqueViolation(error) && changes.username !== undefined) {
        throw new UsernameTakenError(changes.username);
      }
      throw error;
    }
  }
}
