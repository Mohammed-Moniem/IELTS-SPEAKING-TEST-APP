import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

export interface IAdminAuditLog {
  actorUserId: Types.ObjectId;
  action: string;
  targetType: string;
  targetId?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type AdminAuditLogDocument = HydratedDocument<IAdminAuditLog>;

const AdminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      index: true
    },
    targetType: {
      type: String,
      required: true,
      index: true
    },
    targetId: {
      type: String
    },
    details: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

AdminAuditLogSchema.index({ createdAt: -1 });

export const AdminAuditLogModel = model<IAdminAuditLog>('AdminAuditLog', AdminAuditLogSchema);
