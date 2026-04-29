/**
 * Leads Dashboard — Facebook Leads
 * Wraps the existing Acquisition tool inside the Leads layout.
 */
import LeadsLayout from "@/components/LeadsLayout";
import AcquisitionSection from "@/pages/admin/Acquisition";

export default function LeadsFacebook() {
  return (
    <LeadsLayout>
      <AcquisitionSection />
    </LeadsLayout>
  );
}
