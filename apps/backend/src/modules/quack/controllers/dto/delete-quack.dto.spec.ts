import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DeleteQuackDto } from './delete-quack.dto';

// The body the controller's ValidationPipe would turn the JSON into, and
// whether it passes.
const check = async (
  body: object,
): Promise<{ dto: DeleteQuackDto; isValid: boolean }> => {
  const dto = plainToInstance(DeleteQuackDto, body);
  return { dto, isValid: (await validate(dto)).length === 0 };
};

describe('DeleteQuackDto', () => {
  it('trims the reason before measuring it', async () => {
    const { dto, isValid } = await check({ reason: `  ${'x'.repeat(500)}  ` });
    expect(isValid).toBe(true);
    expect(dto.reason).toBe('x'.repeat(500));
  });

  it('refuses a reason over 500 characters', async () => {
    expect((await check({ reason: 'x'.repeat(501) })).isValid).toBe(false);
  });

  // Postgres counts a VARCHAR(500) in code points. "❤️" is two of them (the
  // heart and U+FE0F), which MaxLength would have counted as one.
  it('counts characters the way the database column does', async () => {
    expect((await check({ reason: '❤️'.repeat(250) })).isValid).toBe(true);
    expect((await check({ reason: '❤️'.repeat(251) })).isValid).toBe(false);
    // and an emoji is one character, not the two UTF-16 units JS counts
    expect((await check({ reason: '😀'.repeat(500) })).isValid).toBe(true);
  });

  it('lets the reason be left out', async () => {
    expect((await check({})).isValid).toBe(true);
  });
});
