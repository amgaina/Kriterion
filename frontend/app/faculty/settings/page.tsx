"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function FacultySettingsPage() {
  return (
    <ProtectedRoute allowedRoles={["FACULTY"]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-500 mt-1">
              Manage your account settings and preferences
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Faculty settings will be available here soon.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                This section is reserved for profile, notification, and security
                settings.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
