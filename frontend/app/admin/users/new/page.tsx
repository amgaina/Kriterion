"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert } from "@/components/ui/alert";
import { ArrowLeft, Save, UserPlus } from "lucide-react";
import Link from "next/link";

export default function NewUserPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "STUDENT",
    student_id: "",
    is_active: true,
    send_welcome_email: true,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiClient.createUser({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
        role: data.role,
        student_id: data.student_id || undefined,
        is_active: data.is_active,
        is_verified: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      router.push("/admin/users");
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || "Failed to create user");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (formData.role === "STUDENT" && !formData.student_id.trim()) {
      setError("Student ID is required for student accounts");
      return;
    }

    const password = formData.password;
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter");
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError("Password must contain at least one lowercase letter");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one digit");
      return;
    }
    if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
      setError("Password must contain at least one special character");
      return;
    }

    createMutation.mutate(formData);
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Link href="/admin/users">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Add New User</h1>
              <p className="text-gray-500">Create a new user account</p>
            </div>
          </div>

          {error && (
            <Alert type="error" onClose={() => setError("")}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle>User Information</CardTitle>
                <CardDescription>
                  Enter the details for the new user
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Full Name"
                    value={formData.full_name}
                    onChange={(e) => handleChange("full_name", e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="john@example.com"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <Select
                    label="Role"
                    value={formData.role}
                    onChange={(e) => handleChange("role", e.target.value)}
                    options={[
                      { value: "STUDENT", label: "Student" },
                      { value: "FACULTY", label: "Faculty" },
                      { value: "ADMIN", label: "Admin" },
                    ]}
                  />
                </div>

                {formData.role === "STUDENT" && (
                  <Input
                    label="Student ID"
                    value={formData.student_id}
                    onChange={(e) => handleChange("student_id", e.target.value)}
                    placeholder="STU123456"
                  />
                )}

                <div className="pt-4 border-t border-gray-200 space-y-4">
                  <Switch
                    checked={formData.is_active}
                    onChange={(checked) => handleChange("is_active", checked)}
                    label="Active Account"
                    description="User can login and access the system"
                  />
                  <Switch
                    checked={formData.send_welcome_email}
                    onChange={(checked) =>
                      handleChange("send_welcome_email", checked)
                    }
                    label="Send Welcome Email"
                    description="Send an email with login credentials"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-4 mt-6">
              <Link href="/admin/users">
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={createMutation.isPending}>
                <UserPlus className="w-4 h-4 mr-2" />
                {createMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </div>
          </form>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
