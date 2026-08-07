import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import User from '../../src/models/User';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/testDb';
import { signAccessToken } from '../../src/services/tokenService';

describe('Nearby & Geolocation API', () => {
  let userA: any;
  let userB: any;
  let tokenA: string;

  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // User A at San Francisco (37.7749, -122.4194)
    userA = await User.create({
      username: 'alice',
      displayName: 'Alice',
      email: 'alice@example.com',
      avatarUrl: 'https://example.com/alice.png',
      location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
    });

    // User B at ~2km away (37.7900, -122.4000)
    userB = await User.create({
      username: 'bob',
      displayName: 'Bob',
      email: 'bob@example.com',
      avatarUrl: 'https://example.com/bob.png',
      location: { type: 'Point', coordinates: [-122.4000, 37.7900] },
    });

    tokenA = signAccessToken(userA._id.toString());
  });

  it('updates user location', async () => {
    const res = await request(app)
      .patch('/api/v1/users/location')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ latitude: 37.775, longitude: -122.418 });

    expect(res.status).toBe(200);
    expect(res.body.location.coordinates).toEqual([-122.418, 37.775]);
  });

  it('rejects an update with an out-of-range latitude', async () => {
    const res = await request(app)
      .patch('/api/v1/users/location')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ latitude: 200, longitude: -122.418 });

    expect(res.status).toBe(400);
  });

  it('persists accuracy and a fresh locationUpdatedAt timestamp when accuracy is provided', async () => {
    const res = await request(app)
      .patch('/api/v1/users/location')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ latitude: 37.775, longitude: -122.418, accuracy: 15 });

    expect(res.status).toBe(200);
    const updated = await User.findById(userA._id);
    expect(updated?.locationAccuracy).toBe(15);
    expect(updated?.locationUpdatedAt).toBeInstanceOf(Date);
    expect(Date.now() - (updated!.locationUpdatedAt as Date).getTime()).toBeLessThan(5_000);
  });

  it('accepts accuracy: 0 as a physically valid GPS reading', async () => {
    const res = await request(app)
      .patch('/api/v1/users/location')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ latitude: 37.775, longitude: -122.418, accuracy: 0 });

    expect(res.status).toBe(200);
    const updated = await User.findById(userA._id);
    expect(updated?.locationAccuracy).toBe(0);
  });

  it('returns nearby users within requested radius', async () => {
    const res = await request(app)
      .get('/api/v1/users/nearby?radius=5')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(1);
    expect(res.body.users[0].user.username).toBe('bob');
    expect(res.body.users[0].distanceKm).toBeGreaterThan(0);
    expect(res.body.meta).toEqual(expect.objectContaining({ totalRegistered: 1, totalOnline: expect.any(Number), showingAllUsers: false }));
  });

  it('keeps users without finalized coordinates visible with a null distance', async () => {
    await User.create({
      username: 'sandy',
      displayName: 'Sandy',
      email: 'sandy@example.com',
      avatarUrl: 'https://example.com/sandy.png',
    });

    const res = await request(app)
      .get('/api/v1/users/nearby?radius=1')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const sandy = res.body.users.find((item: any) => item.user.username === 'sandy');
    expect(sandy).toEqual(expect.objectContaining({ distanceKm: null, location: { latitude: null, longitude: null, hasLocation: false } }));
  });
});
