"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DocumentUpload } from "@/components/applicant-portal/document-upload";
import { authHeaders } from "@/lib/applicant-portal/session";

// RPM-010: on submit the wizard first persists the personal + history data to
// the applicant profile (PATCH /api/rpm/applicants/me), then triggers the
// application match-score + status transition.

interface ApplicationWizardProps {
  applicationId: string;
}

interface PersonalInfo {
  firstName: string;
  lastName: string;
  middleName: string;
  contactNumber: string;
  address: string;
}

interface EducationEntry {
  schoolName: string;
  degree: string;
  yearGraduated: string;
}

interface WorkEntry {
  position: string;
  company: string;
  startDate: string;
  endDate: string;
}

interface EligibilityEntry {
  type: string;
  rating: string;
  dateTaken: string;
}

interface TrainingEntry {
  title: string;
  provider: string;
  hours: string;
  dateCompleted: string;
}

interface ReferenceEntry {
  name: string;
  position: string;
  contactNumber: string;
  email: string;
}

const STEPS = [
  "Personal",
  "Education",
  "Work experience",
  "Eligibility",
  "Trainings",
  "References",
  "Documents",
] as const;

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function ApplicationWizard({ applicationId }: ApplicationWizardProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<StepIndex>(0);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const [personal, setPersonal] = React.useState<PersonalInfo>({
    firstName: "",
    lastName: "",
    middleName: "",
    contactNumber: "",
    address: "",
  });
  const [education, setEducation] = React.useState<EducationEntry>({
    schoolName: "",
    degree: "",
    yearGraduated: "",
  });
  const [work, setWork] = React.useState<WorkEntry>({
    position: "",
    company: "",
    startDate: "",
    endDate: "",
  });
  const [eligibility, setEligibility] = React.useState<EligibilityEntry>({
    type: "",
    rating: "",
    dateTaken: "",
  });
  const [training, setTraining] = React.useState<TrainingEntry>({
    title: "",
    provider: "",
    hours: "",
    dateCompleted: "",
  });
  const [reference, setReference] = React.useState<ReferenceEntry>({
    name: "",
    position: "",
    contactNumber: "",
    email: "",
  });

  function validateStep(current: StepIndex): string | null {
    switch (current) {
      case 0:
        if (!personal.firstName.trim() || !personal.lastName.trim()) {
          return "First and last name are required.";
        }
        return null;
      case 1:
        if (!education.schoolName.trim()) return "School name is required.";
        return null;
      case 2:
        if (!work.position.trim() || !work.company.trim()) {
          return "Position and company are required.";
        }
        return null;
      case 3:
        if (!eligibility.type.trim()) return "Eligibility type is required.";
        return null;
      case 4:
        if (!training.title.trim()) return "Training title is required.";
        return null;
      case 5:
        if (!reference.name.trim() || !reference.email.trim()) {
          return "Reference name and email are required.";
        }
        return null;
      default:
        return null;
    }
  }

  function next() {
    const v = validateStep(step);
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    if (step < STEPS.length - 1) setStep((step + 1) as StepIndex);
  }

  function back() {
    if (step > 0) setStep((step - 1) as StepIndex);
    setError(null);
  }

  function buildProfilePayload() {
    const cleanString = (value: string): string | undefined => {
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    };
    const cleanNumber = (value: string): number | undefined => {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    // JSON.stringify drops undefined fields, so optional blanks are omitted.
    return {
      firstName: personal.firstName.trim(),
      lastName: personal.lastName.trim(),
      middleName: cleanString(personal.middleName),
      contactNumber: cleanString(personal.contactNumber),
      currentAddress: cleanString(personal.address),
      profile: {
        education: [
          {
            schoolName: education.schoolName.trim(),
            degree: cleanString(education.degree),
            yearGraduated: cleanNumber(education.yearGraduated),
          },
        ],
        workExperience: [
          {
            position: work.position.trim(),
            company: work.company.trim(),
            startDate: cleanString(work.startDate),
            endDate: cleanString(work.endDate),
          },
        ],
        eligibility: [
          {
            type: eligibility.type.trim(),
            rating: cleanString(eligibility.rating),
            dateTaken: cleanString(eligibility.dateTaken),
          },
        ],
        trainings: [
          {
            title: training.title.trim(),
            provider: cleanString(training.provider),
            hours: cleanNumber(training.hours),
            dateCompleted: cleanString(training.dateCompleted),
          },
        ],
        references: [
          {
            name: reference.name.trim(),
            position: cleanString(reference.position),
            contactNumber: cleanString(reference.contactNumber),
            email: reference.email.trim(),
          },
        ],
      },
    };
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      // Persist wizard data to the applicant profile first (RPM-010).
      const saveRes = await fetch("/api/rpm/applicants/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(buildProfilePayload()),
      });
      if (!saveRes.ok) {
        const problem = (await saveRes.json().catch(() => ({}))) as {
          detail?: string;
        };
        throw new Error(
          problem.detail ?? `Saving your profile failed (${saveRes.status})`,
        );
      }

      const res = await fetch(`/api/rpm/applications/${applicationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ id: applicationId }),
      });
      if (!res.ok) {
        const problem = (await res.json().catch(() => ({}))) as {
          detail?: string;
        };
        throw new Error(problem.detail ?? `Submit failed (${res.status})`);
      }
      router.push(`/applicant/applications/${applicationId}`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={[
              "rounded-full border px-3 py-1 tabular-nums",
              i === step
                ? "border-[#0b1d3a] bg-[#0b1d3a] text-[#fdf8e9]"
                : i < step
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-[#e7ddc7] bg-white text-[#6a5a2b]",
            ].join(" ")}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <section className="rounded-2xl border border-[#e7ddc7] bg-white p-6 shadow-sm">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={personal.firstName}
                onChange={(e) =>
                  setPersonal({ ...personal, firstName: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={personal.lastName}
                onChange={(e) =>
                  setPersonal({ ...personal, lastName: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="middleName">Middle name</Label>
              <Input
                id="middleName"
                value={personal.middleName}
                onChange={(e) =>
                  setPersonal({ ...personal, middleName: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactNumber">Contact number</Label>
              <Input
                id="contactNumber"
                value={personal.contactNumber}
                onChange={(e) =>
                  setPersonal({ ...personal, contactNumber: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                rows={2}
                value={personal.address}
                onChange={(e) =>
                  setPersonal({ ...personal, address: e.target.value })
                }
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="schoolName">School name</Label>
              <Input
                id="schoolName"
                value={education.schoolName}
                onChange={(e) =>
                  setEducation({ ...education, schoolName: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="degree">Degree / Course</Label>
              <Input
                id="degree"
                value={education.degree}
                onChange={(e) =>
                  setEducation({ ...education, degree: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="yearGraduated">Year graduated</Label>
              <Input
                id="yearGraduated"
                type="number"
                value={education.yearGraduated}
                onChange={(e) =>
                  setEducation({ ...education, yearGraduated: e.target.value })
                }
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wPosition">Position</Label>
              <Input
                id="wPosition"
                value={work.position}
                onChange={(e) => setWork({ ...work, position: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wCompany">Company</Label>
              <Input
                id="wCompany"
                value={work.company}
                onChange={(e) => setWork({ ...work, company: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wStart">Start date</Label>
              <Input
                id="wStart"
                type="date"
                value={work.startDate}
                onChange={(e) =>
                  setWork({ ...work, startDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wEnd">End date (leave blank if current)</Label>
              <Input
                id="wEnd"
                type="date"
                value={work.endDate}
                onChange={(e) => setWork({ ...work, endDate: e.target.value })}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="eType">Eligibility type</Label>
              <Input
                id="eType"
                value={eligibility.type}
                onChange={(e) =>
                  setEligibility({ ...eligibility, type: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eRating">Rating</Label>
              <Input
                id="eRating"
                value={eligibility.rating}
                onChange={(e) =>
                  setEligibility({ ...eligibility, rating: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eDate">Date taken</Label>
              <Input
                id="eDate"
                type="date"
                value={eligibility.dateTaken}
                onChange={(e) =>
                  setEligibility({ ...eligibility, dateTaken: e.target.value })
                }
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tTitle">Training title</Label>
              <Input
                id="tTitle"
                value={training.title}
                onChange={(e) =>
                  setTraining({ ...training, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tProvider">Provider</Label>
              <Input
                id="tProvider"
                value={training.provider}
                onChange={(e) =>
                  setTraining({ ...training, provider: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tHours">Hours</Label>
              <Input
                id="tHours"
                type="number"
                value={training.hours}
                onChange={(e) =>
                  setTraining({ ...training, hours: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tDate">Date completed</Label>
              <Input
                id="tDate"
                type="date"
                value={training.dateCompleted}
                onChange={(e) =>
                  setTraining({ ...training, dateCompleted: e.target.value })
                }
              />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rName">Reference name</Label>
              <Input
                id="rName"
                value={reference.name}
                onChange={(e) =>
                  setReference({ ...reference, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rPosition">Reference position</Label>
              <Input
                id="rPosition"
                value={reference.position}
                onChange={(e) =>
                  setReference({ ...reference, position: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rContact">Contact number</Label>
              <Input
                id="rContact"
                value={reference.contactNumber}
                onChange={(e) =>
                  setReference({ ...reference, contactNumber: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rEmail">Email</Label>
              <Input
                id="rEmail"
                type="email"
                value={reference.email}
                onChange={(e) =>
                  setReference({ ...reference, email: e.target.value })
                }
              />
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <p className="text-sm text-[#4b4943]">
              Upload your supporting documents. You can add multiple files
              before submitting.
            </p>
            <DocumentUpload applicationId={applicationId} />
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={back}
          disabled={step === 0 || submitting}
        >
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={next}
            className="bg-[#0b1d3a] text-[#fdf8e9] hover:bg-[#0a1830]"
          >
            Continue
          </Button>
        ) : (
          <Button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="bg-[#0b1d3a] text-[#fdf8e9] hover:bg-[#0a1830]"
          >
            {submitting ? "Submitting…" : "Submit application"}
          </Button>
        )}
      </div>
    </div>
  );
}
