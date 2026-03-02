import 'dotenv/config';
import 'reflect-metadata';
import { connect, connection } from 'mongoose';
import { fileStorageService } from '../src/api/services/FileStorageService';
import { chatService } from '../src/api/services/ChatService';
import { env } from '../src/env';

async function run() {
  await connect(env.db.mongoURL);
  try {
    const buffer = Buffer.from('hello audio file');
    const uploaded = await fileStorageService.uploadFile(buffer, 'hello.m4a', 'audio/m4a', {
      userId: '68ea5227471c2c2257af0fa3',
      conversationId: '68ea5227471c2c2257af0fa3_68ea5227471c2c2257af0fa5',
      messageType: 'audio',
      duration: 3
    });
    console.log('Uploaded file:', uploaded);

    const message = await chatService.sendDirectMessage(
      '68ea5227471c2c2257af0fa3',
      '68ea5227471c2c2257af0fa5',
      '🎙️ Voice note',
      'audio',
      {
        fileName: 'hello.m4a',
        fileSize: buffer.length,
        fileUrl: uploaded.url,
        duration: 3
      }
    );
    console.log('Saved message id:', message._id.toString());
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await connection.close();
  }
}

run().catch(error => {
  console.error('Fatal error', error);
});
