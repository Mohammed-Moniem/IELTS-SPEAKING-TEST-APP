import 'dotenv/config';
import 'reflect-metadata';
import { connect, connection } from 'mongoose';
import { chatService } from '../src/api/services/ChatService';
import { env } from '../src/env';

async function run() {
  await connect(env.db.mongoURL);
  try {
    const message = await chatService.sendDirectMessage(
      '68ea5227471c2c2257af0fa3',
      '68ea5227471c2c2257af0fa5',
      '🎙️ Voice note',
      'audio',
      { fileUrl: 'https://example.com/audio.m4a', fileName: 'test.m4a', fileSize: 1234, duration: 10 }
    );
    console.log('Saved message id:', message._id.toString(), 'type:', message.messageType, 'metadata:', message.metadata);
  } catch (error) {
    console.error('Error sending message:', error);
  } finally {
    await connection.close();
  }
}
run().catch(error => {
  console.error('Fatal', error);
});
