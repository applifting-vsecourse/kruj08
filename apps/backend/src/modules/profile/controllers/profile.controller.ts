import { UsernameTakenError } from '@/modules/profile/domain/profile';
import { ProfileService } from '@/modules/profile/services/profile.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Patch,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProfileResponseDto } from './dto/profile.response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

// There is no :id in these routes on purpose: a user can only ever read and
// edit their own profile, and "own" is decided by the session, not the URL.
@ApiTags('profile')
@Controller('profile')
@UseGuards(AuthenticatedUserGuard)
@ApiCookieAuth()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: "Get the signed-in user's profile" })
  @ApiResponse({ status: 200, type: ProfileResponseDto })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async get(@User() user: Identity): Promise<ProfileResponseDto> {
    const profile = await this.profileService.getProfile(user);
    if (!profile) {
      // A valid session for a row that is gone — only possible if the account
      // was deleted underneath an open browser tab.
      throw new NotFoundException('Profile not found');
    }
    return ProfileResponseDto.fromDomain(profile);
  }

  @Patch()
  @ApiOperation({ summary: "Update the signed-in user's profile" })
  @ApiResponse({ status: 200, type: ProfileResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({ status: 409, description: 'Username is already taken' })
  async update(
    @User() user: Identity,
    @Body() body: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    try {
      const profile = await this.profileService.updateProfile(user, {
        name: body.name,
        username: body.username,
        bio: body.bio,
        defaultMood: body.defaultMood,
      });
      return ProfileResponseDto.fromDomain(profile);
    } catch (error) {
      // The domain says "taken"; HTTP says 409. The translation lives here,
      // at the HTTP boundary, so the service stays free of status codes.
      if (error instanceof UsernameTakenError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
