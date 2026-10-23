import {
  InvalidPollError,
  PollOptionNotFoundError,
  QuackHasNoPollError,
  QuackNotFoundError,
  QuackNotOwnedError,
} from '@/modules/quack/domain/quack';
import { QuacksService } from '@/modules/quack/services/quacks.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateQuackDto } from './dto/create-quack.dto';
import { ListQuacksQueryDto } from './dto/list-quacks-query.dto';
import { QuackResponseDto } from './dto/quack.response.dto';
import { VoteDto } from './dto/vote.dto';

@ApiTags('quacks')
@Controller('quacks')
@UseGuards(AuthenticatedUserGuard)
@ApiCookieAuth()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class QuacksController {
  constructor(private readonly quacksService: QuacksService) {}

  @Get()
  @ApiOperation({
    summary: 'List quacks, optionally narrowed by a search or to your own',
  })
  @ApiResponse({ status: 200, type: [QuackResponseDto] })
  @ApiResponse({ status: 400, description: 'Invalid query' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async list(
    @User() user: Identity,
    @Query() query: ListQuacksQueryDto,
  ): Promise<QuackResponseDto[]> {
    // The viewer decides whose vote shows up as `poll.myOptionId`.
    const quacks = await this.quacksService.getQuacks(user, {
      search: query.search,
      author: query.author,
    });
    return quacks.map((quack) => QuackResponseDto.fromDomain(quack, user.id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a quack, optionally with a poll' })
  @ApiResponse({ status: 201, type: QuackResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async create(
    @User() user: Identity,
    @Body() body: CreateQuackDto,
  ): Promise<QuackResponseDto> {
    try {
      const quack = await this.quacksService.createQuack(user, {
        text: body.text,
        mood: body.mood,
        pollOptions: body.poll?.options,
      });
      return QuackResponseDto.fromDomain(quack, user.id);
    } catch (error) {
      if (error instanceof InvalidPollError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Put(':id/vote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Vote in a quack's poll, or move an existing vote",
    description:
      'One vote per user and poll. Voting again with a different option replaces the previous vote; a vote cannot be withdrawn.',
  })
  @ApiParam({
    name: 'id',
    description: 'Id of the quack that carries the poll',
  })
  @ApiResponse({ status: 200, type: QuackResponseDto })
  @ApiResponse({ status: 400, description: 'Option is not part of this poll' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({ status: 404, description: 'Quack not found or has no poll' })
  async vote(
    @User() user: Identity,
    @Param('id') id: string,
    @Body() body: VoteDto,
  ): Promise<QuackResponseDto> {
    try {
      const quack = await this.quacksService.vote(user, id, body.optionId);
      return QuackResponseDto.fromDomain(quack, user.id);
    } catch (error) {
      // Domain errors become HTTP here, at the boundary, so the service stays
      // free of status codes.
      if (
        error instanceof QuackNotFoundError ||
        error instanceof QuackHasNoPollError
      ) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof PollOptionNotFoundError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete one of your own quacks',
    description:
      'Only the author may delete a quack; the admin role gets no exception. The quack disappears from the feed, search and voting for everyone, together with its poll. It cannot be undone.',
  })
  @ApiParam({ name: 'id', description: 'Id of the quack to delete' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({
    status: 403,
    description: 'The quack belongs to someone else',
  })
  @ApiResponse({
    status: 404,
    description: 'Quack not found or already deleted',
  })
  async delete(@User() user: Identity, @Param('id') id: string): Promise<void> {
    try {
      await this.quacksService.deleteQuack(user, id);
    } catch (error) {
      if (error instanceof QuackNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof QuackNotOwnedError) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }
  }
}
