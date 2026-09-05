"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import { Label }     from "@/components/ui/label";
import { Select }    from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { leadsApi }  from "@/lib/api";
import { e as toEnum } from "@/lib/enum-maps";
import citiesData    from "@/app/Indian_Cities_In_States.json";

export const PROJECT_TYPES = [
  "Web Development",
  "App Development",
  "App + Web Development",
  "Digital Marketing",
  "Design Services",
  "Others",
];

const SOURCES = [
  { value: "ADVERTISEMENT",    label: "Advertisement"    },
  { value: "CLIENT_REFERENCE", label: "Client Reference" },
  { value: "SALES_EXECUTIVE",  label: "Sales Executive"  },
  { value: "OTHER",            label: "Other"            },
];

const STATE_CITIES = citiesData as Record<string, string[]>;
const STATES = Object.keys(STATE_CITIES).sort();

interface FormState {
  fullName:    string;
  phone:       string;
  email:       string;
  projectType: string;
  source:      string;
  state:       string;
  city:        string;
}

const empty: FormState = {
  fullName: "", phone: "", email: "", projectType: "", source: "", state: "", city: "",
};

export function AddLeadForm() {
  const router = useRouter();
  const [form, setForm]               = useState<FormState>(empty);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cities = useMemo(() => (form.state ? STATE_CITIES[form.state] ?? [] : []), [form.state]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    if (name === "state") {
      setForm((p) => ({ ...p, state: value, city: "" }));
    } else {
      setForm((p) => ({ ...p, [name]: value }));
    }
    setErrors((p) => ({ ...p, [name]: "" }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName    = "Client name is required.";
    if (!form.phone.trim())    e.phone       = "Phone number is required.";
    else if (!/^\d{10}$/.test(form.phone)) e.phone = "Enter a valid 10-digit phone number.";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email.";
    if (!form.projectType) e.projectType = "Type of Services is required.";
    if (!form.source)      e.source      = "Source of lead is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);

    try {
      await leadsApi.create({
        fullName:    form.fullName.trim(),
        phone:       form.phone.trim(),
        email:       form.email.trim() || undefined,
        state:       form.state || undefined,
        city:        form.city || undefined,
        serviceType: toEnum.service(form.projectType),
        source:      form.source,
      });
      router.push("/leads");
    } catch (err: any) {
      // Surface field errors (400) or a general message (409, etc.)
      if (err?.errors && typeof err.errors === "object") {
        const fieldErrors: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) {
          fieldErrors[k === "serviceType" ? "projectType" : k] = Array.isArray(v) ? String(v[0]) : String(v);
        }
        setErrors(fieldErrors);
      } else {
        setErrors({ phone: err?.message ?? "Failed to create lead." });
      }
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle>New Lead Details</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-5">

          {/* Client Name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Client Name <span className="text-destructive">*</span></Label>
            <Input id="fullName" name="fullName" placeholder="e.g. Rahul Sharma"
              value={form.fullName} onChange={handleChange} />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
          </div>

          {/* Phone + Email */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
              <Input id="phone" name="phone" type="tel" placeholder="10-digit number"
                value={form.phone} onChange={handleChange} maxLength={10} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="email@example.com (optional)"
                value={form.email} onChange={handleChange} />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
          </div>

          {/* State + City */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Select id="state" name="state" value={form.state} onChange={handleChange} placeholder="Select state">
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Select id="city" name="city" value={form.city} onChange={handleChange}
                placeholder="Select city" disabled={!form.state}>
                {cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          </div>

          {/* Type of Services */}
          <div className="space-y-1.5">
            <Label htmlFor="projectType">Type of Services <span className="text-destructive">*</span></Label>
            <Select id="projectType" name="projectType" value={form.projectType}
              onChange={handleChange} placeholder="Select type">
              {PROJECT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
            {errors.projectType && <p className="text-xs text-destructive">{errors.projectType}</p>}
          </div>

          {/* Source */}
          <div className="space-y-1.5">
            <Label htmlFor="source">Source of Lead <span className="text-destructive">*</span></Label>
            <Select id="source" name="source" value={form.source}
              onChange={handleChange} placeholder="Select source">
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
            {errors.source && <p className="text-xs text-destructive">{errors.source}</p>}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Submit Lead"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
              Cancel
            </Button>
          </div>

        </form>
      </CardContent>
    </Card>
  );
}
