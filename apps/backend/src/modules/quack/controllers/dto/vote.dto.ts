import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VoteDto {
  @ApiProperty({
    description:
      'Id of the option to vote for. Voting again with a different option moves the vote.',
    example: 'cmgpq7x1b0003abcd1234efgh',
  })
  @IsString()
  @IsNotEmpty()
  optionId!: string;
}
