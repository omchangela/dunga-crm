"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import { Label }     from "@/components/ui/label";
import { Select }    from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { fetchLead, leadsApi } from "@/lib/api";
import { e as toEnum } from "@/lib/enum-maps";
import citiesData from "@/app/Indian_Cities_In_States.json";

const SOURCES = [
  { value: "ADVERTISEMENT",    label: "Advertisement"    },
  { value: "CLIENT_REFERENCE", label: "Client Reference" },
  { value: "SALES_EXECUTIVE",  label: "Sales Executive"  },
  { value: "OTHER",            label: "Other"            },
];

const STATUSES = [
  { value: "PENDING",  label: "Pending"  },
  { value: "REJECTED", label: "Rejected" },
];

const PROJECT_TYPES = [
  "Web Development",
  "App Development",
  "App + Web Development",
  "Digital Marketing",
  "Design Services",
  "Others",
];

const STATE_CITIES = citiesData as Record<string, string[]>;
const STATES = Object.keys(STATE_CITIES).sort();

export default function EditLeadPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [lead, setLead] = useState<any>(null);
  const [form, setForm] = useState({
    fullName:    "",
    phone:       "",
    email:       "",
    state:       "",
    city:        "",
    projectType: "",
    status:      "PENDING",
    source:      "",
  });
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cities = useMemo(() => (form.state ? STATE_CITIES[form.state] ?? [] : []), [form.state]);

  useEffect(() => {
    if (!id) return;
    fetchLead(id)
      .then((found) => {
        if (found) {
          setLead(found);
          setForm({
            fullName:    found.fullName    ?? "",
            phone:       found.phone       ?? "",
            email:       found.email       ?? "",
            state:       found.state       ?? "",
            city:        found.city        ?? "",
            projectType: found.projectType ?? "",
            status:      found.status      ?? "PENDING",
            source:      found.source      ?? "",
          });
        }
      })
      .catch(() => setLead(null));
  }, [id]);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.fullName.trim())    e.fullName    = "Client name is required.";
    if (!form.phone.trim())       e.phone       = "Phone number is required.";
    else if (!/^\d{10}$/.test(form.phone)) e.phone = "Enter a valid 10-digit phone number.";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email.";
    if (!form.projectType) e.projectType = "Type of Services is required.";
    if (!form.source)      e.source      = "Source of lead is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    if (isSubmitting) return; // Prevent entry manipulation while saving
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
    if (isSubmitting || !validate()) return; // Idempotency check
    setIsSubmitting(true);

    try {
      await leadsApi.update(id, {
        fullName:    form.fullName.trim(),
        phone:       form.phone.trim(),
        email:       form.email.trim(),
        state:       form.state,
        city:        form.city,
        serviceType: toEnum.service(form.projectType),
        source:      form.source,
        status:      form.status,
      });
      router.push(`/leads/${id}`);
    } catch (err: any) {
      if (err?.errors && typeof err.errors === "object") {
        const fieldErrors: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) {
          fieldErrors[k === "serviceType" ? "projectType" : k] = Array.isArray(v) ? String(v[0]) : String(v);
        }
        setErrors(fieldErrors);
      } else {
        setErrors({ phone: err?.message ?? "Failed to save changes." });
      }
      setIsSubmitting(false);
    }
  }

  if (!lead) {
    return <div className="flex items-center justify-center py-20 text-sm text-[#8094ae]">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        {/* Disable back navigation button during submit */}
        <Button asChild variant="ghost" size="icon" className={isSubmitting ? "pointer-events-none opacity-50" : ""}>
          <Link href={`/leads/${id}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <PageHeader title="Edit Lead" subtitle={lead.fullName} />
      </div>

      <Card className="mx-auto max-w-2xl">
        <CardHeader><CardTitle>Edit Lead Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Client Name */}
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Client Name <span className="text-destructive">*</span></Label>
              <Input id="fullName" name="fullName" value={form.fullName} onChange={handleChange} disabled={isSubmitting} />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
            </div>

            {/* Phone + Email */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
                <Input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} maxLength={10} disabled={isSubmitting} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="optional" value={form.email} onChange={handleChange} disabled={isSubmitting} />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
            </div>

            {/* State + City */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="state">State</Label>
                <Select id="state" name="state" value={form.state} onChange={handleChange} placeholder="Select state" disabled={isSubmitting}>
                  {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Select id="city" name="city" value={form.city} onChange={handleChange}
                  placeholder="Select city" disabled={!form.state || isSubmitting}>
                  {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
            </div>

            {/* Type of Services + Status */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="projectType">Type of Services <span className="text-destructive">*</span></Label>
                <Select id="projectType" name="projectType" value={form.projectType} onChange={handleChange} disabled={isSubmitting}>
                  <option value="">Select type</option>
                  {PROJECT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
                {errors.projectType && <p className="text-xs text-destructive">{errors.projectType}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status <span className="text-destructive">*</span></Label>
                <Select id="status" name="status" value={form.status} onChange={handleChange} disabled={isSubmitting}>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Source */}
            <div className="space-y-1.5">
              <Label htmlFor="source">Source of Lead <span className="text-destructive">*</span></Label>
              <Select id="source" name="source" value={form.source} onChange={handleChange} disabled={isSubmitting}>
                <option value="">Select source</option>
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
              {errors.source && <p className="text-xs text-destructive">{errors.source}</p>}
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