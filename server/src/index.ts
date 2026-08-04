import http from 'http';
import { env } from './config/env';
import { connectDB } from './config/database';
import app from './app';
import { setupSocketIO } from './socket';
import { seedAdminUser } from './services/adminSeedService';

async function main(): Promise<void> {
  await connectDB(env.MONGODB_URI);
  await seedAdminUser();
  const server = http.createServer(app);
  setupSocketIO(server);

  server.listen(env.PORT, () => {
    console.log(`NearMe server listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
