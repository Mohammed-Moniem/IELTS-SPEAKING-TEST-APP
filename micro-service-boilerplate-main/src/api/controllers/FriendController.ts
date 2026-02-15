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
  QueryParam
} from 'routing-controllers';
import { Logger } from '../../lib/logger';
import { emitToUser } from '../../loaders/SocketIOLoader';
import { friendService } from '../services/FriendService';

const log = new Logger(__filename);

@JsonController('/friends')
export class FriendController {
  /**
   * Send friend request
   * POST /api/friends/request
   */
  @Post('/request')
  @HttpCode(201)
  async sendFriendRequest(
    @CurrentUser({ required: true }) currentUser: any,
    @Body() body: { recipientId: string; message?: string }
  ) {
    try {
      const request = await friendService.sendFriendRequest(currentUser.id, body.recipientId, body.message);

      // Notify recipient via Socket.io
      emitToUser(body.recipientId, 'friend:request:receive', {
        senderId: currentUser.id,
        requestId: request._id,
        timestamp: new Date()
      });

      // Serialize the Mongoose document
      const cleanRequest = JSON.parse(JSON.stringify(request));

      return {
        success: true,
        message: 'Friend request sent',
        data: cleanRequest
      };
    } catch (error: any) {
      log.error('Error sending friend request:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get pending friend requests (received)
   * GET /api/friends/requests
   */
  @Get('/requests')
  async getPendingRequests(@CurrentUser({ required: true }) currentUser: any) {
    try {
      const requests = await friendService.getPendingRequests(currentUser.id);

      return {
        success: true,
        data: requests
      };
    } catch (error: any) {
      log.error('Error getting pending requests:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get sent friend requests
   * GET /api/friends/requests/sent
   */
  @Get('/requests/sent')
  async getSentRequests(@CurrentUser({ required: true }) currentUser: any) {
    try {
      const requests = await friendService.getSentRequests(currentUser.id);

      return {
        success: true,
        data: requests
      };
    } catch (error: any) {
      log.error('Error getting sent requests:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Accept friend request
   * POST /api/friends/accept/:requestId
   */
  @Post('/accept/:requestId')
  async acceptFriendRequest(@CurrentUser({ required: true }) currentUser: any, @Param('requestId') requestId: string) {
    try {
      await friendService.acceptFriendRequest(requestId);

      return {
        success: true,
        message: 'Friend request accepted'
      };
    } catch (error: any) {
      log.error('Error accepting friend request:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Decline friend request
   * POST /api/friends/decline/:requestId
   */
  @Post('/decline/:requestId')
  async declineFriendRequest(@CurrentUser({ required: true }) currentUser: any, @Param('requestId') requestId: string) {
    try {
      await friendService.declineFriendRequest(requestId);

      return {
        success: true,
        message: 'Friend request declined'
      };
    } catch (error: any) {
      log.error('Error declining friend request:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Remove friend
   * DELETE /api/friends/:friendId
   */
  @Delete('/:friendId')
  async removeFriend(@CurrentUser({ required: true }) currentUser: any, @Param('friendId') friendId: string) {
    try {
      await friendService.removeFriend(currentUser.id, friendId);

      return {
        success: true,
        message: 'Friend removed'
      };
    } catch (error: any) {
      log.error('Error removing friend:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get friends list
   * GET /api/friends
   */
  @Get('/')
  async getFriends(@CurrentUser({ required: true }) currentUser: any) {
    try {
      const friends = await friendService.getFriends(currentUser.id);

      return {
        success: true,
        data: friends
      };
    } catch (error: any) {
      log.error('Error getting friends:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Search users
   * GET /api/friends/search?q=username
   */
  @Get('/search')
  async searchUsers(
    @CurrentUser({ required: true }) currentUser: any,
    @QueryParam('q') query: string,
    @QueryParam('limit') limit?: number
  ) {
    try {
      if (!query || query.length < 2) {
        throw new BadRequestError('Search query must be at least 2 characters');
      }

      const users = await friendService.searchUsers(query, currentUser.id, limit || 20);

      return {
        success: true,
        data: users
      };
    } catch (error: any) {
      log.error('Error searching users:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get friend suggestions
   * GET /api/friends/suggestions
   */
  @Get('/suggestions')
  async getFriendSuggestions(@CurrentUser({ required: true }) currentUser: any, @QueryParam('limit') limit?: number) {
    try {
      const suggestions = await friendService.getFriendSuggestions(currentUser.id, limit || 10);

      return {
        success: true,
        data: suggestions
      };
    } catch (error: any) {
      log.error('Error getting friend suggestions:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Block user
   * POST /api/friends/block/:userId
   */
  @Post('/block/:userId')
  async blockUser(@CurrentUser({ required: true }) currentUser: any, @Param('userId') userId: string) {
    try {
      await friendService.blockUser(currentUser.id, userId);

      return {
        success: true,
        message: 'User blocked'
      };
    } catch (error: any) {
      log.error('Error blocking user:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get blocked users
   * GET /api/friends/blocked
   */
  @Get('/blocked')
  async getBlockedUsers(@CurrentUser({ required: true }) currentUser: any) {
    try {
      const blockedIds = await friendService.getBlockedUsers(currentUser.id);

      return {
        success: true,
        data: blockedIds
      };
    } catch (error: any) {
      log.error('Error getting blocked users:', error);
      throw new BadRequestError(error.message);
    }
  }
}
