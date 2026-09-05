import { PageHeader } from "@/components/layout/page-header";
import { AddLeadForm } from "@/components/leads/add-lead-form";

export default function NewLeadPage() {
  return (
<div className="space-y-6 max-w-2xl mx-auto w-full">
  <PageHeader
    title="Add Lead"
    subtitle="Fill in the details to register a new software lead."
  />
  <AddLeadForm />
</div>
  );
}
