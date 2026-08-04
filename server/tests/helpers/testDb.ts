import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer | undefined;

export async function startTestDb(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  // Sync indexes once at connection time to ensure unique constraints work with mongodb-memory-server
  const models = Object.values(mongoose.connection.models);
  if (models.length > 0) {
    await Promise.all(models.map(m => m.syncIndexes()));
  }
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await mongod?.stop();
}

export async function clearTestDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key]!.deleteMany({});
  }
}
