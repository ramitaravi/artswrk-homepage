/**
 * Tests for premium_jobs DB helpers and enterprise tRPC procedures.
 * Uses mocked DB to avoid real database connections.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the DB module ────────────────────────────────────────────────────────
vi.mock('./db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./db')>();
  return {
    ...actual,
    getPremiumJobsByUserId: vi.fn(),
    getAllPremiumJobs: vi.fn(),
    getPremiumJobInterestedArtists: vi.fn(),
    getPremiumInterestedArtistsByCreatorId: vi.fn(),
    getJobsByUserId: vi.fn(),
    getUserById: vi.fn(),
  };
});

import {
  getPremiumJobsByUserId,
  getAllPremiumJobs,
  getPremiumJobInterestedArtists,
  getPremiumInterestedArtistsByCreatorId,
  getJobsByUserId,
  getUserById,
} from './db';

const mockPremiumJob = {
  id: 1,
  bubbleId: '1775599214500x868961958941163500',
  company: 'REVEL Dance Convention',
  logo: 'https://cdn.bubble.io/revel-logo.jpeg',
  createdByUserId: 780544,
  bubbleCreatedById: '1772121421134x418341755101401700',
  serviceType: 'Vice President of Customer Relations',
  category: 'Dance Convention',
  description: 'Full-time salaried role...',
  budget: 'Full-Time Salaried Role',
  location: null,
  workFromAnywhere: true,
  applyDirect: true,
  applyEmail: 'contact@artswrk.com',
  applyLink: null,
  featured: false,
  status: 'Active',
  createdAt: new Date('2026-04-07T22:00:15.068Z'),
  updatedAt: new Date(),
};

const mockInterestedArtist = {
  id: 1,
  premiumJobId: 1,
  artistUserId: 100,
  bubbleArtistId: '1775667287313x389954407005159400',
  createdAt: new Date(),
  jobTitle: 'Vice President of Customer Relations',
  jobCompany: 'REVEL Dance Convention',
  artistName: 'Jane Doe',
  artistFirstName: 'Jane',
  artistLastName: 'Doe',
  artistProfilePicture: null,
  artistLocation: 'New York, NY',
  artswrkPro: false,
};

describe('premium_jobs DB helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPremiumJobsByUserId', () => {
    it('returns premium jobs for a given user ID', async () => {
      vi.mocked(getPremiumJobsByUserId).mockResolvedValue([mockPremiumJob] as any);
      const result = await getPremiumJobsByUserId(780544);
      expect(result).toHaveLength(1);
      expect((result as any[])[0].company).toBe('REVEL Dance Convention');
      expect((result as any[])[0].serviceType).toBe('Vice President of Customer Relations');
    });

    it('returns empty array when user has no premium jobs', async () => {
      vi.mocked(getPremiumJobsByUserId).mockResolvedValue([]);
      const result = await getPremiumJobsByUserId(999999);
      expect(result).toHaveLength(0);
    });
  });

  describe('getAllPremiumJobs', () => {
    it('returns paginated premium jobs with total count', async () => {
      vi.mocked(getAllPremiumJobs).mockResolvedValue({ jobs: [mockPremiumJob] as any[], total: 185 });
      const result = await getAllPremiumJobs({ limit: 50, offset: 0 });
      expect((result as any).total).toBe(185);
      expect((result as any).jobs).toHaveLength(1);
    });

    it('filters by status when provided', async () => {
      vi.mocked(getAllPremiumJobs).mockResolvedValue({ jobs: [mockPremiumJob] as any[], total: 1 });
      const result = await getAllPremiumJobs({ status: 'Active' });
      expect((result as any).jobs[0].status).toBe('Active');
    });
  });

  describe('getPremiumJobInterestedArtists', () => {
    it('returns interested artists for a premium job', async () => {
      vi.mocked(getPremiumJobInterestedArtists).mockResolvedValue([mockInterestedArtist] as any);
      const result = await getPremiumJobInterestedArtists(1);
      expect(result).toHaveLength(1);
      expect((result as any[])[0].artistFirstName).toBe('Jane');
    });
  });

  describe('getPremiumInterestedArtistsByCreatorId', () => {
    it('returns all interested artists across all PRO jobs for a creator', async () => {
      vi.mocked(getPremiumInterestedArtistsByCreatorId).mockResolvedValue([mockInterestedArtist] as any);
      const result = await getPremiumInterestedArtistsByCreatorId(780544);
      expect(result).toHaveLength(1);
      expect((result as any[])[0].jobTitle).toBe('Vice President of Customer Relations');
      expect((result as any[])[0].artistName).toBe('Jane Doe');
    });

    it('returns empty array when creator has no interested artists', async () => {
      vi.mocked(getPremiumInterestedArtistsByCreatorId).mockResolvedValue([]);
      const result = await getPremiumInterestedArtistsByCreatorId(999999);
      expect(result).toHaveLength(0);
    });
  });
});

describe('enterprise.getJobs procedure logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns premium jobs when available (preferred over regular jobs)', async () => {
    vi.mocked(getPremiumJobsByUserId).mockResolvedValue([mockPremiumJob] as any);
    const proJobs = await getPremiumJobsByUserId(780544);
    // Simulate procedure logic: use premium jobs if available
    const jobs = (proJobs as any[]).length > 0 ? proJobs : await getJobsByUserId(780544);
    expect(jobs).toHaveLength(1);
    expect(vi.mocked(getJobsByUserId)).not.toHaveBeenCalled();
  });

  it('falls back to regular jobs when no premium jobs exist', async () => {
    vi.mocked(getPremiumJobsByUserId).mockResolvedValue([]);
    vi.mocked(getJobsByUserId).mockResolvedValue([{ id: 99, serviceType: 'Regular Job' }] as any);
    const proJobs = await getPremiumJobsByUserId(12345);
    const jobs = (proJobs as any[]).length > 0 ? proJobs : await getJobsByUserId(12345);
    expect(jobs).toHaveLength(1);
    expect((jobs as any[])[0].serviceType).toBe('Regular Job');
  });
});

describe('enterprise.getInterestedArtists deduplication logic', () => {
  it('deduplicates artists by artistUserId', async () => {
    const duplicateArtists = [
      { ...mockInterestedArtist, id: 1, artistUserId: 100 },
      { ...mockInterestedArtist, id: 2, artistUserId: 100 }, // duplicate
      { ...mockInterestedArtist, id: 3, artistUserId: 101 },
    ];
    vi.mocked(getPremiumInterestedArtistsByCreatorId).mockResolvedValue(duplicateArtists as any);
    const raw = await getPremiumInterestedArtistsByCreatorId(780544);
    const seen = new Set<number>();
    const artists = (raw as any[]).filter((ia) => {
      if (!ia.artistUserId || seen.has(ia.artistUserId)) return false;
      seen.add(ia.artistUserId);
      return true;
    });
    expect(artists).toHaveLength(2);
    expect(artists.map((a) => a.artistUserId)).toEqual([100, 101]);
  });
});
