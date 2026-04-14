import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SENDGRID_TEMPLATES, sendJobPostedEmail, sendTransactionalEmail } from "./email";

// ─── Mock @sendgrid/mail ──────────────────────────────────────────────────────
vi.mock("@sendgrid/mail", () => {
  const mockSend = vi.fn().mockResolvedValue([{ statusCode: 202 }, {}]);
  const mockSetApiKey = vi.fn();
  return {
    default: {
      setApiKey: mockSetApiKey,
      send: mockSend,
    },
    __esModule: true,
  };
});

describe("email.ts", () => {
  beforeEach(() => {
    process.env.SENDGRID_API_KEY = "SG.test-key";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("SENDGRID_TEMPLATES", () => {
    it("should have the JOB_POSTED template ID", () => {
      expect(SENDGRID_TEMPLATES.JOB_POSTED).toBe("d-e2dcf8797ac545d68a03f610a7323fce");
    });
  });

  describe("sendTransactionalEmail", () => {
    it("should return false when SENDGRID_API_KEY is not set", async () => {
      delete process.env.SENDGRID_API_KEY;
      const result = await sendTransactionalEmail({
        to: "test@example.com",
        templateId: "d-test",
        dynamicData: { foo: "bar" },
      });
      expect(result).toBe(false);
    });

    it("should call sgMail.send with correct parameters", async () => {
      const sgMail = await import("@sendgrid/mail");
      const result = await sendTransactionalEmail({
        to: "artist@example.com",
        templateId: "d-abc123",
        dynamicData: { FirstName: "Jane" },
      });
      expect(result).toBe(true);
      expect(sgMail.default.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "artist@example.com",
          templateId: "d-abc123",
          dynamicTemplateData: { FirstName: "Jane" },
        })
      );
    });

    it("should return false and log error on send failure", async () => {
      const sgMail = await import("@sendgrid/mail");
      vi.mocked(sgMail.default.send).mockRejectedValueOnce(new Error("Unauthorized"));
      const result = await sendTransactionalEmail({
        to: "bad@example.com",
        templateId: "d-test",
        dynamicData: {},
      });
      expect(result).toBe(false);
    });
  });

  describe("sendJobPostedEmail", () => {
    it("should map all fields correctly to SendGrid dynamic template data", async () => {
      const sgMail = await import("@sendgrid/mail");
      const result = await sendJobPostedEmail({
        to: "studio@artswrk.com",
        firstName: "Phyllis",
        service: "Ballet Teacher",
        artistType: "Dancer",
        date: "Saturday, April 15",
        location: "New York, NY",
        transportDetails: "Subway accessible",
        transportReimbursed: "Yes",
        description: "Looking for a ballet teacher for Saturday class.",
        jobLink: "https://artswrk.com/jobs/123",
      });
      expect(result).toBe(true);
      expect(sgMail.default.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "studio@artswrk.com",
          templateId: SENDGRID_TEMPLATES.JOB_POSTED,
          dynamicTemplateData: expect.objectContaining({
            FirstName: "Phyllis",
            Service: "Ballet Teacher",
            ArtistType: "Dancer",
            Date: "Saturday, April 15",
            Location: "New York, NY",
            TransportDetails: "Subway accessible",
            TransportReimbursed: "Yes",
            Description: "Looking for a ballet teacher for Saturday class.",
            joblink: "https://artswrk.com/jobs/123",
            subject: "Your job has been posted!",
          }),
        })
      );
    });

    it("should use default values for optional transport fields", async () => {
      const sgMail = await import("@sendgrid/mail");
      await sendJobPostedEmail({
        to: "studio@artswrk.com",
        firstName: "Nick",
        service: "Hip Hop Teacher",
        artistType: "Dancer",
        date: "Flexible",
        location: "Chicago, IL",
        description: "Need a hip hop teacher.",
        jobLink: "https://artswrk.com/jobs/456",
      });
      expect(sgMail.default.send).toHaveBeenCalledWith(
        expect.objectContaining({
          dynamicTemplateData: expect.objectContaining({
            TransportDetails: "N/A",
            TransportReimbursed: "No",
          }),
        })
      );
    });
  });
});
