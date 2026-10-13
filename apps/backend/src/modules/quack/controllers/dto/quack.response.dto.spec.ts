import { Quack } from '@/modules/quack/domain/quack';
import { QuackResponseDto } from './quack.response.dto';

const aQuackWithPoll = (myOptionId: string | null): Quack => ({
  id: 'q1',
  text: 'Lunch?',
  mood: null,
  userId: 'author',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  user: { id: 'author', name: 'Caffeinated Duck', username: 'CaffeinatedDuck' },
  poll: {
    id: 'p1',
    options: [
      { id: 'o1', text: 'Pizza', position: 0, votes: 2 },
      { id: 'o2', text: 'Sushi', position: 1, votes: 1 },
    ],
    totalVotes: 3,
    myOptionId,
  },
});

describe('QuackResponseDto', () => {
  describe('poll.canSeeResults', () => {
    it('is false for someone else who has not voted', () => {
      const dto = QuackResponseDto.fromDomain(aQuackWithPoll(null), 'viewer');
      expect(dto.poll?.canSeeResults).toBe(false);
    });

    it('is true for someone else once they have voted', () => {
      const dto = QuackResponseDto.fromDomain(aQuackWithPoll('o1'), 'viewer');
      expect(dto.poll?.canSeeResults).toBe(true);
    });

    it('is true for the author even before they vote', () => {
      const dto = QuackResponseDto.fromDomain(aQuackWithPoll(null), 'author');
      expect(dto.poll?.canSeeResults).toBe(true);
      // not voting is still reported as such, so the UI highlights nothing
      expect(dto.poll?.myOptionId).toBeNull();
    });
  });

  it('keeps the poll id out of the response', () => {
    const dto = QuackResponseDto.fromDomain(aQuackWithPoll(null), 'viewer');
    expect(dto.poll).not.toHaveProperty('id');
  });

  it('maps a plain quack with poll null', () => {
    const dto = QuackResponseDto.fromDomain(
      { ...aQuackWithPoll(null), poll: null },
      'viewer',
    );
    expect(dto.poll).toBeNull();
  });
});
