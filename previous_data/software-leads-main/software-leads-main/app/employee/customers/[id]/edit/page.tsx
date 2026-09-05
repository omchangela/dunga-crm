"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { employeePortalApi } from "@/lib/api";
import { e as toEnum } from "@/lib/enum-maps";
import citiesData from "@/app/Indian_Cities_In_States.json";

const STATUS_OPTIONS = ["Active", "Inactive"] as const;

const STATE_CITIES = citiesData as Record<string, string[]>;
const STATES = Object.keys(STATE_CITIES).sort();

export default function EmployeeEditCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [customer, setCustomer]         = useState<any>(null);
  const [form, setForm]                 = useState({ state: "", city: "", status: "Active" });
  const [errors, setErrors]             = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cities = useMemo(() => (form.state ? STATE_CITIES[form.state] ?? [] : []), [form.state]);

  useEffect(() => {
    if (!id) return;
    employeePortalApi.getCustomerDetail(id)
      .then((found) => {
        if (found) {
          setCustomer(found);
          setForm({
            state:  found.state  ?? "",
            city:   found.city   ?? "",
            status: found.status ?? "Active",
          });
        }
      })
      .catch(() => setCustomer(null));
  }, [id]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    if (name === "state") {
      setForm((p) => ({ ...p, state: value, city: "" }));
    } else {
      setForm((p) => ({ ...p, [name]: value }));
    }
    setErrors((p) => ({ ...p, [name]: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await employeePortalApi.updateCustomer(id, {
        state:  form.state,
        city:   form.city,
        status: toEnum.status(form.status),
      });
      router.push(`/employee/customers/${id}`);
    } catch (err: any) {
      setErrors({ status: err?.message ?? "Failed to save changes." });
      setIsSubmitting(false);
    }
  }

  if (!customer) {
    return <div className="flex items-center justify-center py-20 text-sm text-[#8094ae]">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/employee/customers/${id}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <PageHeader title="Edit Customer" subtitle={customer.fullName} />
      </div>

      {/* Read-only customer info */}
      <Card className="mx-auto max-w-2xl border-dashed">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-[#8094ae]">Customer Information (read-only)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Client Name</p>
              <p className="font-medium text-gray-700">{customer.fullName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="font-medium text-gray-700">{customer.phone}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="font-medium text-gray-700">{customer.email || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Service Type</p>
              <p className="font-medium text-gray-700">{customer.projectType || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Application Number</p>
              <p className="font-mono font-medium text-gray-700">{customer.applicationNumber || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editable fields */}
      <Card className="mx-auto max-w-2xl">
        <CardHeader><CardTitle>Edit Customer Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="state">State</Label>
                <Select id="state" name="state" value={form.state} onChange={handleChange} placeholder="Select state">
                  {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" value={form.city} onChange={handleChange}
                  placeholder="Enter city" list="city-options" />
                <datalist id="city-options">
                  {cities.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Status <span className="text-destructive">*</span></Label>
              <Select id="status" name="status" value={form.status} onChange={handleChange}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              {errors.status && <p className="text-xs text-destructive">{errors.status}</p>}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                Cancel
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
