import User from '../models/User';
import { hashPassword } from './passwordService';
import { env } from '../config/env';
import { getFunkyAvatarUrl, isLetterOrLegacyAvatar } from '../utils/avatarUtils';

export async function seedAdminUser(): Promise<void> {
  try {
    // Migration check: Upgrade any legacy letter initials avatars stored in DB to unique funky illustration avatars
    const usersWithLegacyAvatars = await User.find({
      $or: [
        { avatarUrl: { $regex: /initials/i } },
        { avatarUrl: '' },
        { avatarUrl: null },
      ],
    });

    for (const user of usersWithLegacyAvatars) {
      user.avatarUrl = getFunkyAvatarUrl(user.username || user.displayName || user._id.toString());
      await user.save();
    }

    if (!env.SEED_ADMIN) return;

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
    console.error('Failed to seed admin user or migrate avatars:', err);
    throw err;
  }
}

