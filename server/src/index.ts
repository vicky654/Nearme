import { env } from './config/env';
import { connectDB } from './config/database';
import app from './app';

async function main(): Promise<void> {
  await connectDB(env.MONGODB_URI);
  app.listen(env.PORT, () => {
    console.log(`NearMe server listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
