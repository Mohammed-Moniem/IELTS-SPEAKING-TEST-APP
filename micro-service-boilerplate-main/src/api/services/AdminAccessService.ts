import { Service } from 'typedi';

import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { AdminAuditLogModel } from '@models/AdminAuditLogModel';

export type AdminRole = 'superadmin' | 'content_manager' | 'support_agent';

@Service()
export class AdminAccessService {
  public assertHasRole(user: { id: string; roles?: string[] } | undefined, allowed: AdminRole[]) {
    if (!user?.id) {
      throw new CSError(HTTP_STATUS_CODES.UNAUTHORIZED, CODES.NotAuthorized, 'Authentication required');
    }

    const roles = user.roles || [];
    const hasAccess = roles.some(role => allowed.includes(role as AdminRole));

    if (!hasAccess) {
      throw new CSError(HTTP_STATUS_CODES.FORBIDDEN, CODES.Forbidden, 'Admin role required for this operation');
    }
  }

  public async audit(params: {
    actorUserId: string;
    action: string;
    targetType: string;
    targetId?: string;
    details?: Record<string, unknown>;
  }) {
    await AdminAuditLogModel.create({
      actorUserId: params.actorUserId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      details: params.details || {}
    });
  }
}
