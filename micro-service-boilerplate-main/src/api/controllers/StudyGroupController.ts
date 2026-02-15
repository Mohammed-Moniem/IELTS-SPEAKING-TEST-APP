import {
  BadRequestError,
  Body,
  CurrentUser,
  Delete,
  Get,
  HttpCode,
  JsonController,
  Param,
  Post,
  Put,
  QueryParam
} from 'routing-controllers';
import { Logger } from '../../lib/logger';
import { studyGroupService } from '../services/StudyGroupService';

const log = new Logger(__filename);

@JsonController('/groups')
export class StudyGroupController {
  @Post('/')
  @HttpCode(201)
  async createGroup(
    @CurrentUser({ required: true }) currentUser: any,
    @Body() body: { name: string; description?: string; metadata?: any; settings?: any; memberIds?: string[] }
  ) {
    try {
      const group = await studyGroupService.createGroup(
        currentUser.id,
        body.name,
        body.description,
        body.metadata,
        body.settings,
        body.memberIds || []
      );
      return { success: true, data: group };
    } catch (error: any) {
      log.error('Error creating group:', error);
      throw new BadRequestError(error.message);
    }
  }

  @Get('/')
  async getUserGroups(@CurrentUser({ required: true }) currentUser: any) {
    try {
      const groups = await studyGroupService.getUserGroups(currentUser.id);
      return { success: true, data: groups };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  @Get('/search')
  async searchGroups(
    @CurrentUser({ required: true }) currentUser: any,
    @QueryParam('q') query: string,
    @QueryParam('ieltsType') ieltsType?: string,
    @QueryParam('targetCountry') targetCountry?: string,
    @QueryParam('limit') limit?: number
  ) {
    try {
      const resolvedIeltsType =
        ieltsType === 'academic' || ieltsType === 'general' ? (ieltsType as 'academic' | 'general') : undefined;

      const groups = await studyGroupService.searchGroups(
        query,
        currentUser.id,
        { ieltsType: resolvedIeltsType, targetCountry },
        limit || 20
      );
      return { success: true, data: groups };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  @Get('/suggestions')
  async getSuggestedGroups(@CurrentUser({ required: true }) currentUser: any, @QueryParam('limit') limit?: number) {
    try {
      const groups = await studyGroupService.getSuggestedGroups(currentUser.id, limit || 10);
      return { success: true, data: groups };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  @Get('/invites')
  async getUserInvites(@CurrentUser({ required: true }) currentUser: any) {
    try {
      const invites = await studyGroupService.getUserInvites(currentUser.id);
      return { success: true, data: invites };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  @Get('/:groupId')
  async getGroup(@CurrentUser({ required: true }) currentUser: any, @Param('groupId') groupId: string) {
    try {
      const group = await studyGroupService.getGroup(groupId, currentUser.id);
      return { success: true, data: group };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  @Put('/:groupId')
  async updateGroup(
    @CurrentUser({ required: true }) currentUser: any,
    @Param('groupId') groupId: string,
    @Body() updates: any
  ) {
    try {
      const group = await studyGroupService.updateGroup(groupId, currentUser.id, updates);
      return { success: true, data: group };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  @Delete('/:groupId')
  async deleteGroup(@CurrentUser({ required: true }) currentUser: any, @Param('groupId') groupId: string) {
    try {
      await studyGroupService.deleteGroup(groupId, currentUser.id);
      return { success: true, message: 'Group deleted' };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  @Post('/:groupId/invite')
  async inviteMember(
    @CurrentUser({ required: true }) currentUser: any,
    @Param('groupId') groupId: string,
    @Body() body: { inviteeId: string; message?: string }
  ) {
    try {
      const invite = await studyGroupService.inviteMember(groupId, currentUser.id, body.inviteeId, body.message);
      return { success: true, data: invite };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  @Post('/:groupId/members')
  async addMember(
    @CurrentUser({ required: true }) currentUser: any,
    @Param('groupId') groupId: string,
    @Body() body: { memberId: string }
  ) {
    try {
      const group = await studyGroupService.addMember(groupId, currentUser.id, body.memberId);
      return { success: true, data: group };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  @Post('/invites/:inviteId/accept')
  async acceptInvite(@CurrentUser({ required: true }) currentUser: any, @Param('inviteId') inviteId: string) {
    try {
      await studyGroupService.acceptInvite(inviteId, currentUser.id);
      return { success: true, message: 'Invitation accepted' };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  @Post('/invites/:inviteId/decline')
  async declineInvite(@CurrentUser({ required: true }) currentUser: any, @Param('inviteId') inviteId: string) {
    try {
      await studyGroupService.declineInvite(inviteId, currentUser.id);
      return { success: true, message: 'Invitation declined' };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  @Post('/:groupId/join')
  async joinGroup(@CurrentUser({ required: true }) currentUser: any, @Param('groupId') groupId: string) {
    try {
      const group = await studyGroupService.joinGroup(groupId, currentUser.id);
      return { success: true, data: group };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  @Post('/:groupId/leave')
  async leaveGroup(@CurrentUser({ required: true }) currentUser: any, @Param('groupId') groupId: string) {
    try {
      await studyGroupService.leaveGroup(groupId, currentUser.id);
      return { success: true, message: 'Left group' };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  @Get('/:groupId/members')
  async getGroupMembers(@Param('groupId') groupId: string) {
    try {
      const members = await studyGroupService.getGroupMembers(groupId);
      return { success: true, data: members };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  @Delete('/:groupId/members/:userId')
  async removeMember(
    @CurrentUser({ required: true }) currentUser: any,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string
  ) {
    try {
      await studyGroupService.removeMember(groupId, currentUser.id, userId);
      return { success: true, message: 'Member removed' };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  @Post('/:groupId/admins/:userId')
  async promoteToAdmin(
    @CurrentUser({ required: true }) currentUser: any,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string
  ) {
    try {
      await studyGroupService.promoteToAdmin(groupId, currentUser.id, userId);
      return { success: true, message: 'Member promoted to admin' };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  @Delete('/:groupId/admins/:userId')
  async removeAdmin(
    @CurrentUser({ required: true }) currentUser: any,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string
  ) {
    try {
      await studyGroupService.removeAdmin(groupId, currentUser.id, userId);
      return { success: true, message: 'Admin privileges removed' };
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }
}
