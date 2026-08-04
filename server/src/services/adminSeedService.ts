import User from '../models/User';
import { hashPassword } from './passwordService';

export async function seedAdminUser(): Promise<void> {
  try {
    const adminEmail = 'admin@nearme.com';
    const existingAdmin = await User.findOne({
      $or: [{ role: 'admin' }, { email: adminEmail }],
    });

    if (!existingAdmin) {
      const passwordHash = await hashPassword('Admin@12345');
      await User.create({
        username: 'admin',
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
      console.log('Successfully seeded default admin account (admin@nearme.com / Admin@12345)');
    }
  } catch (err) {
    console.error('Failed to seed admin user:', err);
  }
}
