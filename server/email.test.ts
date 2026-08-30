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
    // C1 is inline HTML now, not a SendGrid dynamic template. These assert the
    // rendered body rather than merge fields, and specifically cover the three
    // faults the template shipped on 2026-08-28: BBCode leaking through from
    // old Bubble descriptions, empty "()" rows for absent fields, and literal
    // "*Service:*" asterisks.
    const base = {
      to: "studio@artswrk.com",
      firstName: "Phyllis",
      serviceType: "Ballet Teacher",
      date: "Saturday, April 15",
      location: "New York, NY",
      rate: "$50/hr",
      description: "Looking for a ballet teacher for Saturday class.",
      jobLink: "https://artswrk.com/jobs/123",
      transportation: true,
    };

    const sentMessage = async () => {
      const sgMail = await import("@sendgrid/mail");
      return (sgMail.default.send as any).mock.calls[0][0];
    };

    it("sends inline HTML to the client, cc'ing support, from the Artswrk address", async () => {
      const result = await sendJobPostedEmail(base);
      expect(result).toBe(true);

      const msg = await sentMessage();
      expect(msg.to).toBe("studio@artswrk.com");
      expect(msg.cc).toBe("support@artswrk.com");
      expect(msg.from).toEqual(expect.objectContaining({ email: "contact@artswrk.com" }));
      expect(msg.subject).toContain("live");
      // The template layer is gone — a templateId here would mean a regression.
      expect(msg.templateId).toBeUndefined();
      expect(msg.html).toContain("Phyllis");
      expect(msg.html).toContain("Ballet Teacher");
      expect(msg.html).toContain("https://artswrk.com/jobs/123");
    });

    it("strips Bubble BBCode out of the description", async () => {
      await sendJobPostedEmail({
        ...base,
        description: "[color=rgb(94, 94, 94)]Ballet teacher wanted.[/color]",
      });
      const msg = await sentMessage();
      expect(msg.html).toContain("Ballet teacher wanted.");
      expect(msg.html).not.toContain("[color");
      expect(msg.html).not.toContain("[/color]");
    });

    it("includes the transportation row when transportation is true", async () => {
      await sendJobPostedEmail({ ...base, transportation: true, transportDetails: "Subway reimbursed" });
      const msg = await sentMessage();
      expect(msg.html).toContain("Transportation");
      expect(msg.html).toContain("Subway reimbursed");
    });

    it("omits the transportation row entirely when false — never an empty ()", async () => {
      await sendJobPostedEmail({ ...base, transportation: false });
      const msg = await sentMessage();
      expect(msg.html).not.toContain("Transportation");
      expect(msg.html).not.toMatch(/\(\s*\)/);
    });

    it("drops rows whose value is missing rather than rendering a blank", async () => {
      await sendJobPostedEmail({ ...base, location: "", rate: "", transportation: false });
      const msg = await sentMessage();
      expect(msg.html).not.toContain("Location");
      expect(msg.html).not.toContain("Rate");
      expect(msg.html).toContain("Ballet Teacher");
    });

    it("carries the SendGrid unsubscribe substitution tags", async () => {
      await sendJobPostedEmail(base);
      const msg = await sentMessage();
      expect(msg.html).toContain("<%asm_group_unsubscribe_raw_url%>");
    });
  });
});
