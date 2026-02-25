import { apiClient } from '../../api/client';

export interface PartnerPortalMe {
  enabled: boolean;
  isPartner: boolean;
  status?: 'pending' | 'active' | 'suspended' | 'rejected' | string;
  partnerType?: 'influencer' | 'institute' | string;
  partnerId?: string;
  dashboardUrl?: string;
  registrationUrl?: string;
  partner?: Record<string, unknown> | null;
}

export interface PartnerApplicationPayload {
  partnerType: 'influencer' | 'institute';
  displayName: string;
  legalName?: string;
  contactEmail?: string;
  notes?: string;
}

class PartnerService {
  async getMe(): Promise<PartnerPortalMe> {
    const response = await apiClient.get('/partners/me');
    return response.data.data;
  }

  async submitApplication(payload: PartnerApplicationPayload): Promise<unknown> {
    const response = await apiClient.post('/partners/applications', payload);
    return response.data.data;
  }

  async getDashboard(): Promise<unknown> {
    const response = await apiClient.get('/partners/dashboard');
    return response.data.data;
  }
}

export default new PartnerService();
