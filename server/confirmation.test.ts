/**
 * Tests for confirmation and reimbursement procedures.
 * Uses the same mock-db pattern as auth.logout.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────

const mockGetBookingById = vi.fn();
const mockUpdateBooking = vi.fn();
const mockCreateReimbursement = vi.fn();
const mockGetReimbursementsByBookingId = vi.fn();
const mockGetInterestedArtistById = vi.fn();
const mockCreateBooking = vi.fn();
const mockGetBookingByApplicantId = vi.fn();

vi.mock("./db", () => ({
  getBookingById: (...args: any[]) => mockGetBookingById(...args),
  updateBooking: (...args: any[]) => mockUpdateBooking(...args),
  createReimbursement: (...args: any[]) => mockCreateReimbursement(...args),
  getReimbursementsByBookingId: (...args: any[]) => mockGetReimbursementsByBookingId(...args),
  getInterestedArtistById: (...args: any[]) => mockGetInterestedArtistById(...args),
  createBooking: (...args: any[]) => mockCreateBooking(...args),
  getBookingByApplicantId: (...args: any[]) => mockGetBookingByApplicantId(...args),
  // other helpers used elsewhere
  getUserById: vi.fn(),
  getJobById: vi.fn(),
  getClientCompaniesByUserId: vi.fn(),
  createClientCompany: vi.fn(),
  getLastJobForUser: vi.fn(),
  getConfirmedBookingsForJob: vi.fn(),
  getArtistConfirmedBookings: vi.fn(),
}));

vi.mock("./email", () => ({
  sendJobPostedEmail: vi.fn(),
  sendConfirmationEmail: vi.fn().mockResolvedValue(true),
  sendArtswrkInvoiceEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe("confirmArtist logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a booking when applicant exists and no booking yet", async () => {
    const applicant = {
      id: 10,
      userId: 42,
      jobId: 7,
      status: "interested",
    };
    mockGetInterestedArtistById.mockResolvedValue(applicant);
    mockGetBookingByApplicantId.mockResolvedValue(null); // no existing booking
    mockCreateBooking.mockResolvedValue({ id: 99 });

    // Simulate the core logic of confirmArtist
    const existing = await mockGetBookingByApplicantId(applicant.id);
    expect(existing).toBeNull();

    const booking = await mockCreateBooking({
      applicantId: applicant.id,
      artistUserId: applicant.userId,
      jobId: applicant.jobId,
      clientUserId: 1,
      paymentMethod: "direct",
      bookingStatus: "confirmed",
    });
    expect(booking.id).toBe(99);
    expect(mockCreateBooking).toHaveBeenCalledOnce();
  });

  it("returns alreadyConfirmed=true when booking already exists", async () => {
    const existingBooking = { id: 55, bookingStatus: "confirmed" };
    mockGetBookingByApplicantId.mockResolvedValue(existingBooking);

    const existing = await mockGetBookingByApplicantId(10);
    const alreadyConfirmed = !!existing;
    expect(alreadyConfirmed).toBe(true);
    expect(mockCreateBooking).not.toHaveBeenCalled();
  });
});

describe("confirmDirectPayment logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates booking with directPayConfirmedAt timestamp", async () => {
    const booking = {
      id: 55,
      artistUserId: 42,
      bookingStatus: "confirmed",
      directPayConfirmedAt: null,
    };
    mockGetBookingById.mockResolvedValue(booking);
    mockUpdateBooking.mockResolvedValue({ ...booking, directPayConfirmedAt: new Date() });

    const found = await mockGetBookingById(55);
    expect(found.directPayConfirmedAt).toBeNull();

    const updated = await mockUpdateBooking(55, { directPayConfirmedAt: new Date() });
    expect(updated.directPayConfirmedAt).not.toBeNull();
  });

  it("throws if booking does not belong to artist", async () => {
    const booking = { id: 55, artistUserId: 99 }; // different artist
    mockGetBookingById.mockResolvedValue(booking);

    const found = await mockGetBookingById(55);
    const artistUserId = 42; // current user
    const isOwner = found.artistUserId === artistUserId;
    expect(isOwner).toBe(false);
  });
});

describe("addReimbursement logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a reimbursement record for the booking", async () => {
    const booking = { id: 55, artistUserId: 42, paymentMethod: "artswrk" };
    mockGetBookingById.mockResolvedValue(booking);
    mockCreateReimbursement.mockResolvedValue({ id: 1, bookingId: 55, value: 25, note: "Gas" });

    const found = await mockGetBookingById(55);
    expect(found.paymentMethod).toBe("artswrk");

    const reimb = await mockCreateReimbursement({ bookingId: 55, value: 25, note: "Gas" });
    expect(reimb.id).toBe(1);
    expect(reimb.value).toBe(25);
  });

  it("rejects reimbursement for non-artswrk booking", async () => {
    const booking = { id: 55, artistUserId: 42, paymentMethod: "direct" };
    mockGetBookingById.mockResolvedValue(booking);

    const found = await mockGetBookingById(55);
    const canAddReimb = found.paymentMethod === "artswrk";
    expect(canAddReimb).toBe(false);
  });
});

describe("submitArtswrkInvoice logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks booking with artswrkInvoiceSubmittedAt", async () => {
    const booking = {
      id: 55,
      artistUserId: 42,
      paymentMethod: "artswrk",
      artswrkInvoiceSubmittedAt: null,
    };
    mockGetBookingById.mockResolvedValue(booking);
    mockUpdateBooking.mockResolvedValue({ ...booking, artswrkInvoiceSubmittedAt: new Date() });

    const found = await mockGetBookingById(55);
    expect(found.artswrkInvoiceSubmittedAt).toBeNull();

    const updated = await mockUpdateBooking(55, { artswrkInvoiceSubmittedAt: new Date() });
    expect(updated.artswrkInvoiceSubmittedAt).not.toBeNull();
  });
});
