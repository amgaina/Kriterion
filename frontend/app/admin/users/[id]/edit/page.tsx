"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useQuery } from "@tanstack/react-query";
import { useMutationWithInvalidation } from '@/lib/use-mutation-with-invalidation';
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
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = Number(params.id);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    role: "STUDENT",
    student_id: "",
    is_active: true,
  });

  // Fetch user data
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => apiClient.getUser(userId),
    enabled: !!userId,
  });

  // Populate form when user data loads
  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || "",
        full_name: user.full_name || "",
        role: user.role || "STUDENT",
        student_id: user.student_id || "",
        is_active: user.is_active ?? true,
      });
    }
  }, [user]);

  const updateMutation = useMutationWithInvalidation({
    mutationFn: (data: typeof formData) => apiClient.updateUser(userId, {
      email: data.email,
      full_name: data.full_name,
      role: data.role,
      student_id: data.student_id || undefined,
      is_active: data.is_active,
    }),
    invalidateGroups: ['allUsers', 'allDashboards'],
    onSuccess: () => {
      router.push('/admin/users');
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to update user');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (formData.role === "STUDENT" && !formData.student_id.trim()) {
      setError("Student ID is required for student accounts");
      return;
    }

    updateMutation.mutate(formData);
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoadingUser) {
    return (
      <ProtectedRoute allowedRoles={["ADMIN"]}>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
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
            <h1 className="text-2xl font-bold text-gray-900">Edit User</h1>
            <p className="text-gray-500">Update user account details</p>
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
                Update the details for {user?.full_name}
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
                <Select
                  label="Role"
                  value={formData.role}
                  onChange={(e) => handleChange("role", e.target.value)}
                  options={[
                    { value: "STUDENT", label: "Student" },
                    { value: "FACULTY", label: "Faculty" },
                    { value: "ASSISTANT", label: "Assistant" },
                    { value: "ADMIN", label: "Admin" },
                  ]}
                />
                {formData.role === "STUDENT" && (
                  <Input
                    label="Student ID"
                    value={formData.student_id}
                    onChange={(e) => handleChange("student_id", e.target.value)}
                    placeholder="STU123456"
                  />
                )}
              </div>

              <div className="pt-4 border-t border-gray-200 space-y-4">
                <Switch
                  checked={formData.is_active}
                  onChange={(checked) => handleChange("is_active", checked)}
                  label="Active Account"
                  description="User can login and access the system"
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
            <Button type="submit" disabled={updateMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </ProtectedRoute>
  );
}
