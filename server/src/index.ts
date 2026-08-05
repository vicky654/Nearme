import http from 'http';
import mongoose from 'mongoose';
import { env } from './config/env';
import { connectDB } from './config/database';
import app from './app';
import { setupSocketIO } from './socket';
import { seedAdminUser } from './services/adminSeedService';

async function main(): Promise<void> {
  await connectDB(env.MONGODB_URI);
  await seedAdminUser();
  const server = http.createServer(app);
  const io = setupSocketIO(server);
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; closing NearMe gracefully`);
    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();
    server.closeIdleConnections();
    io.close(async () => {
      try { await mongoose.disconnect(); } catch { /* The process is already shutting down. */ }
      clearTimeout(forceExit);
      process.exit(0);
    });
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  server.listen(env.PORT, () => {
    console.log(`NearMe server listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
