import User from '../models/User';
import { hashPassword } from './passwordService';
import { env } from '../config/env';

export async function seedAdminUser(): Promise<void> {
  if (!env.SEED_ADMIN) return;
  try {
    const adminEmail = env.ADMIN_EMAIL || 'admin@nearme.com';
    const adminUsername = env.ADMIN_USERNAME || 'admin';
    const adminPassword = env.ADMIN_PASSWORD || 'Admin@12345';
    const existingAdmin = await User.findOne({
      $or: [{ role: 'admin' }, { email: adminEmail }],
    });

    if (!existingAdmin) {
      const passwordHash = await hashPassword(adminPassword);
      await User.create({
        username: adminUsername,
        displayName: 'System Admin',
        email: adminEmail,
        passwordHash,
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        bio: 'NearMe Administrator Account',
        role: 'admin',
        status: 'active',
        emailVerifiedAt: new Date(),
        interests: ['Administration', 'Security', 'Moderation'],
        languages: ['English'],
      });
      console.log(`Successfully seeded administrator account for ${adminEmail}`);
    }
  } catch (err) {
    console.error('Failed to seed admin user:', err);
    throw err;
  }
}
