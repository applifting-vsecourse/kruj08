import { buildMessage, ValidateBy, ValidationOptions } from 'class-validator';

// Characters as Postgres counts them in a VARCHAR(n) column: Unicode code
// points. JavaScript's `length` counts UTF-16 units instead (an emoji is 2),
// and class-validator's MaxLength counts neither way: it treats a surrogate
// pair as one and a variation selector (the U+FE0F in "❤️") as none, so a
// string it accepts can still be too long for the column.
export const characterCount = (value: string): number => [...value].length;

// MaxLength, counted like the database column the value ends up in.
export const MaxCharacters = (
  max: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator =>
  ValidateBy(
    {
      name: 'maxCharacters',
      constraints: [max],
      validator: {
        validate: (value: unknown): boolean =>
          typeof value === 'string' && characterCount(value) <= max,
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be shorter than or equal to $constraint1 characters`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
