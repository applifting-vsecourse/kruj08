// The repository is mocked, so the test exercises the service in isolation —
// the same pattern as quacks.service.spec.ts.
import { Profile, UsernameTakenError } from '@/modules/profile/domain/profile';
import { ProfileRepository } from '@/modules/profile/repositories/profile.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { mock } from 'jest-mock-extended';
import { ProfileService } from './profile.service';

const aProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'u1',
  name: 'Caffeinated Duck',
  username: 'CaffeinatedDuck',
  bio: null,
  defaultMood: null,
  ...overrides,
});

const user = { id: 'u1' } as Identity;

describe('ProfileService', () => {
  it('returns the signed-in user profile from the repository', async () => {
    const profile = aProfile();
    const repository = mock<ProfileRepository>();
    repository.findByUserId.mockResolvedValue(profile);

    const service = new ProfileService(repository);

    await expect(service.getProfile(user)).resolves.toEqual(profile);
    // the profile is always the caller's own: the id comes from the session
    expect(repository.findByUserId).toHaveBeenCalledWith('u1');
  });

  it('updates the profile when the new username is free', async () => {
    const updated = aProfile({ username: 'Espresso_Duck', name: 'Espresso' });
    const repository = mock<ProfileRepository>();
    repository.isUsernameTaken.mockResolvedValue(false);
    repository.updateProfile.mockResolvedValue(updated);

    const service = new ProfileService(repository);

    await expect(
      service.updateProfile(user, {
        username: 'Espresso_Duck',
        name: 'Espresso',
      }),
    ).resolves.toEqual(updated);
    // the caller's own row must be excluded from the uniqueness check
    expect(repository.isUsernameTaken).toHaveBeenCalledWith(
      'Espresso_Duck',
      'u1',
    );
    expect(repository.updateProfile).toHaveBeenCalledWith('u1', {
      username: 'Espresso_Duck',
      name: 'Espresso',
      bio: undefined,
    });
  });

  it('rejects a username someone else already has', async () => {
    const repository = mock<ProfileRepository>();
    repository.isUsernameTaken.mockResolvedValue(true);

    const service = new ProfileService(repository);

    await expect(
      service.updateProfile(user, { username: 'BreadCritic' }),
    ).rejects.toBeInstanceOf(UsernameTakenError);
    // nothing is written when the check fails
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it('skips the uniqueness check when the username is not being changed', async () => {
    const repository = mock<ProfileRepository>();
    repository.updateProfile.mockResolvedValue(aProfile({ name: 'Duck' }));

    const service = new ProfileService(repository);

    await service.updateProfile(user, { name: 'Duck' });

    expect(repository.isUsernameTaken).not.toHaveBeenCalled();
  });

  it('stores an empty bio as null and trims a real one', async () => {
    const repository = mock<ProfileRepository>();
    repository.updateProfile.mockResolvedValue(aProfile());

    const service = new ProfileService(repository);

    await service.updateProfile(user, { bio: '   ' });
    expect(repository.updateProfile).toHaveBeenLastCalledWith('u1', {
      bio: null,
    });

    await service.updateProfile(user, { bio: '  Quacks about coffee.  ' });
    expect(repository.updateProfile).toHaveBeenLastCalledWith('u1', {
      bio: 'Quacks about coffee.',
    });
  });

  it('passes a cleared default mood through as null', async () => {
    const repository = mock<ProfileRepository>();
    repository.updateProfile.mockResolvedValue(aProfile());

    const service = new ProfileService(repository);

    await service.updateProfile(user, { defaultMood: null });

    expect(repository.updateProfile).toHaveBeenCalledWith('u1', {
      defaultMood: null,
      bio: undefined,
    });
  });
});
