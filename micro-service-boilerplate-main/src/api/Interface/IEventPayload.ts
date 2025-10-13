export interface IEventPayload {
  messageId: string;
  type: string;
  event: string;
  queue: string;
  headers: {
    requestId: string;
    source: string;
    correlationId: string;
    urc: string;
  };
  timestamp: string;
  payload: any;
  metadata: {
    version: string;
    priority: string;
    tags: string[];
  };
}
