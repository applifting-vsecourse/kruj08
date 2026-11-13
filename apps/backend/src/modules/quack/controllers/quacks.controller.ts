import {
  CannotReplyToReplyError,
  DeletionReasonRequiredError,
  InvalidPollError,
  NotAModeratorError,
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
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateQuackDto } from './dto/create-quack.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { DeleteQuackDto } from './dto/delete-quack.dto';
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
    description:
      'Top-level quacks only, newest first; replies come from GET /quacks/{id}/replies. A deleted quack with live replies stays in the list as a placeholder (`deleted: true`, no content). A search also matches the text and author of live replies, and `author=me` also lists quacks you replied under; such quacks come with `matchedInReplies: true`.',
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
    return quacks.map((quack) => QuackResponseDto.fromDomain(quack, user));
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
      return QuackResponseDto.fromDomain(quack, user);
    } catch (error) {
      if (error instanceof InvalidPollError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Get(':id/replies')
  @ApiOperation({
    summary: 'List the live replies under a quack, oldest first',
    description:
      'Works for a deleted quack too, as long as the list still shows it as a placeholder.',
  })
  @ApiParam({ name: 'id', description: 'Id of the quack replied to' })
  @ApiResponse({ status: 200, type: [QuackResponseDto] })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({
    status: 404,
    description:
      'Quack not found, deleted with no replies left, or itself a reply',
  })
  async listReplies(
    @User() user: Identity,
    @Param('id') id: string,
  ): Promise<QuackResponseDto[]> {
    try {
      const replies = await this.quacksService.getReplies(user, id);
      return replies.map((reply) => QuackResponseDto.fromDomain(reply, user));
    } catch (error) {
      if (error instanceof QuackNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Post(':id/replies')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Reply to a quack',
    description:
      'A reply has text and an optional mood, no poll. Threads are one level deep: a reply cannot be replied to. A deleted quack takes no new replies, even while its existing replies are still shown under it.',
  })
  @ApiParam({ name: 'id', description: 'Id of the quack to reply to' })
  @ApiResponse({ status: 201, type: QuackResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Validation failed, or the quack is itself a reply',
  })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({
    status: 404,
    description: 'Quack not found or deleted (possibly in the meantime)',
  })
  async reply(
    @User() user: Identity,
    @Param('id') id: string,
    @Body() body: CreateReplyDto,
  ): Promise<QuackResponseDto> {
    try {
      const reply = await this.quacksService.createReply(user, id, {
        text: body.text,
        mood: body.mood,
      });
      return QuackResponseDto.fromDomain(reply, user);
    } catch (error) {
      if (error instanceof CannotReplyToReplyError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof QuackNotFoundError) {
        throw new NotFoundException(error.message);
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
      return QuackResponseDto.fromDomain(quack, user);
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
    summary: 'Delete one of your own quacks, or any quack as an admin',
    description:
      'An author may delete their own quack or reply. An admin may delete any, and must give a reason every time, for their own too. The quack disappears from the feed, search and voting for everyone, together with its poll, and who deleted it is recorded; if live replies remain under it, it stays in the list as a placeholder without content. It cannot be undone.',
  })
  @ApiParam({ name: 'id', description: 'Id of the quack to delete' })
  @ApiBody({ type: DeleteQuackDto, required: false })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({
    status: 400,
    description: 'An admin gave no reason, or the reason is too long',
  })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({
    status: 403,
    description: 'The quack belongs to someone else and you are not an admin',
  })
  @ApiResponse({
    status: 404,
    description: 'Quack not found or already deleted',
  })
  async delete(
    @User() user: Identity,
    @Param('id') id: string,
    @Body() body: DeleteQuackDto,
  ): Promise<void> {
    try {
      await this.quacksService.deleteQuack(user, id, body.reason);
    } catch (error) {
      if (error instanceof DeletionReasonRequiredError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof QuackNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (
        error instanceof QuackNotOwnedError ||
        error instanceof NotAModeratorError
      ) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }
  }
}
