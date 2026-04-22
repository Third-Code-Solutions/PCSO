"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEmployee } from "@/lib/actions/pimm/employees";

export function EmployeeCreateForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    // Convert numeric fields
    const input = {
      ...data,
      salaryGrade: data.salaryGrade
        ? parseInt(data.salaryGrade as string)
        : undefined,
      step: data.step ? parseInt(data.step as string) : undefined,
    };

    const result = await createEmployee(input);

    if ("error" in result) {
      setError(result.error);
      setIsSubmitting(false);
    } else {
      router.push(`/employees/${result.data.id}`);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-8 divide-y divide-gray-200"
    >
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Personal Information */}
      <div className="space-y-6 pt-6">
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Personal Information
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            All TOR 1.3.1 fields (PIM-001)
          </p>
        </div>

        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label
              htmlFor="employeeNo"
              className="block text-sm font-medium text-gray-700"
            >
              Employee Number *
            </label>
            <input
              type="text"
              name="employeeNo"
              id="employeeNo"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-gray-700"
            >
              First Name *
            </label>
            <input
              type="text"
              name="firstName"
              id="firstName"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="middleName"
              className="block text-sm font-medium text-gray-700"
            >
              Middle Name
            </label>
            <input
              type="text"
              name="middleName"
              id="middleName"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="lastName"
              className="block text-sm font-medium text-gray-700"
            >
              Last Name *
            </label>
            <input
              type="text"
              name="lastName"
              id="lastName"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-1">
            <label
              htmlFor="suffix"
              className="block text-sm font-medium text-gray-700"
            >
              Suffix
            </label>
            <input
              type="text"
              name="suffix"
              id="suffix"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="birthDate"
              className="block text-sm font-medium text-gray-700"
            >
              Birth Date *
            </label>
            <input
              type="date"
              name="birthDate"
              id="birthDate"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="gender"
              className="block text-sm font-medium text-gray-700"
            >
              Gender *
            </label>
            <select
              name="gender"
              id="gender"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="civilStatus"
              className="block text-sm font-medium text-gray-700"
            >
              Civil Status *
            </label>
            <select
              name="civilStatus"
              id="civilStatus"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Select...</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="widowed">Widowed</option>
              <option value="legally_separated">Legally Separated</option>
              <option value="annulled">Annulled</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="nationality"
              className="block text-sm font-medium text-gray-700"
            >
              Nationality *
            </label>
            <input
              type="text"
              name="nationality"
              id="nationality"
              defaultValue="Filipino"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="religion"
              className="block text-sm font-medium text-gray-700"
            >
              Religion
            </label>
            <input
              type="text"
              name="religion"
              id="religion"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="bloodType"
              className="block text-sm font-medium text-gray-700"
            >
              Blood Type
            </label>
            <select
              name="bloodType"
              id="bloodType"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Select...</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>
        </div>
      </div>

      {/* Government IDs */}
      <div className="space-y-6 pt-6">
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Government IDs
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <label
              htmlFor="tin"
              className="block text-sm font-medium text-gray-700"
            >
              TIN
            </label>
            <input
              type="text"
              name="tin"
              id="tin"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-3">
            <label
              htmlFor="gsisNo"
              className="block text-sm font-medium text-gray-700"
            >
              GSIS No
            </label>
            <input
              type="text"
              name="gsisNo"
              id="gsisNo"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-3">
            <label
              htmlFor="philhealthNo"
              className="block text-sm font-medium text-gray-700"
            >
              PhilHealth No
            </label>
            <input
              type="text"
              name="philhealthNo"
              id="philhealthNo"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-3">
            <label
              htmlFor="pagibigNo"
              className="block text-sm font-medium text-gray-700"
            >
              Pag-IBIG No
            </label>
            <input
              type="text"
              name="pagibigNo"
              id="pagibigNo"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Bank Details */}
      <div className="space-y-6 pt-6">
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Bank Details
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <label
              htmlFor="bankName"
              className="block text-sm font-medium text-gray-700"
            >
              Bank Name
            </label>
            <input
              type="text"
              name="bankName"
              id="bankName"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-3">
            <label
              htmlFor="bankAccountNumber"
              className="block text-sm font-medium text-gray-700"
            >
              Bank Account Number
            </label>
            <input
              type="text"
              name="bankAccountNumber"
              id="bankAccountNumber"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Position / Appointment */}
      <div className="space-y-6 pt-6">
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Position / Appointment
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <label
              htmlFor="appointmentType"
              className="block text-sm font-medium text-gray-700"
            >
              Appointment Type *
            </label>
            <select
              name="appointmentType"
              id="appointmentType"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Select...</option>
              <option value="permanent">Permanent</option>
              <option value="temporary">Temporary</option>
              <option value="coterminous">Coterminous</option>
              <option value="casual">Casual</option>
              <option value="job_order">Job Order</option>
              <option value="contract_of_service">Contract of Service</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <label
              htmlFor="positionTitle"
              className="block text-sm font-medium text-gray-700"
            >
              Position Title *
            </label>
            <input
              type="text"
              name="positionTitle"
              id="positionTitle"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="salaryGrade"
              className="block text-sm font-medium text-gray-700"
            >
              Salary Grade *
            </label>
            <input
              type="number"
              name="salaryGrade"
              id="salaryGrade"
              min="1"
              max="33"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="step"
              className="block text-sm font-medium text-gray-700"
            >
              Step *
            </label>
            <input
              type="number"
              name="step"
              id="step"
              min="1"
              max="8"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="officeId"
              className="block text-sm font-medium text-gray-700"
            >
              Office ID
            </label>
            <input
              type="text"
              name="officeId"
              id="officeId"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Employment Dates */}
      <div className="space-y-6 pt-6">
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Employment Dates
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <label
              htmlFor="dateHired"
              className="block text-sm font-medium text-gray-700"
            >
              Date Hired *
            </label>
            <input
              type="date"
              name="dateHired"
              id="dateHired"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-3">
            <label
              htmlFor="dateRegularized"
              className="block text-sm font-medium text-gray-700"
            >
              Date Regularized
            </label>
            <input
              type="date"
              name="dateRegularized"
              id="dateRegularized"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="space-y-6 pt-6">
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Contact
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              type="email"
              name="email"
              id="email"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-3">
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700"
            >
              Phone
            </label>
            <input
              type="text"
              name="phone"
              id="phone"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-6 pt-6">
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Address
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-6">
            <label
              htmlFor="addressStreet"
              className="block text-sm font-medium text-gray-700"
            >
              Street
            </label>
            <input
              type="text"
              name="addressStreet"
              id="addressStreet"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="addressBarangay"
              className="block text-sm font-medium text-gray-700"
            >
              Barangay
            </label>
            <input
              type="text"
              name="addressBarangay"
              id="addressBarangay"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="addressCity"
              className="block text-sm font-medium text-gray-700"
            >
              City
            </label>
            <input
              type="text"
              name="addressCity"
              id="addressCity"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="addressProvince"
              className="block text-sm font-medium text-gray-700"
            >
              Province
            </label>
            <input
              type="text"
              name="addressProvince"
              id="addressProvince"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="addressZipCode"
              className="block text-sm font-medium text-gray-700"
            >
              Zip Code
            </label>
            <input
              type="text"
              name="addressZipCode"
              id="addressZipCode"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Emergency Contact */}
      <div className="space-y-6 pt-6">
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Emergency Contact
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label
              htmlFor="emergencyContactName"
              className="block text-sm font-medium text-gray-700"
            >
              Name
            </label>
            <input
              type="text"
              name="emergencyContactName"
              id="emergencyContactName"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="emergencyContactRelationship"
              className="block text-sm font-medium text-gray-700"
            >
              Relationship
            </label>
            <input
              type="text"
              name="emergencyContactRelationship"
              id="emergencyContactRelationship"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="emergencyContactPhone"
              className="block text-sm font-medium text-gray-700"
            >
              Phone
            </label>
            <input
              type="text"
              name="emergencyContactPhone"
              id="emergencyContactPhone"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="pt-5">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Employee"}
          </button>
        </div>
      </div>
    </form>
  );
}
