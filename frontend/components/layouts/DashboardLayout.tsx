"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { Dropdown } from "@/components/ui/dropdown";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// Icons as components
const DashboardIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
    />
  </svg>
);

const BookIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
    />
  </svg>
);

const AssignmentIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const SubmissionIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
    />
  </svg>
);

const ReportIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
);

const UsersIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
    />
  </svg>
);

const SettingsIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const AuditIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
    />
  </svg>
);

const GradeIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const LogoutIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);

const MenuIcon = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6h16M4 12h16M4 18h16"
    />
  </svg>
);

const CloseIcon = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

const getNavItems = (role: UserRole): NavItem[] => {
  const baseUrl =
    role === "STUDENT"
      ? "/student"
      : role === "FACULTY"
        ? "/faculty"
        : "/admin";

  if (role === "STUDENT") {
    return [
      {
        label: "Dashboard",
        href: `${baseUrl}/dashboard`,
        icon: <DashboardIcon />,
      },
      { label: "My Courses", href: `${baseUrl}/courses`, icon: <BookIcon /> },
      {
        label: "Assignments",
        href: `${baseUrl}/assignments`,
        icon: <AssignmentIcon />,
      },
      { label: "Grades", href: `${baseUrl}/grades`, icon: <GradeIcon /> },
      { label: "Progress", href: `${baseUrl}/progress`, icon: <ReportIcon /> },
      { label: "Schedule", href: `${baseUrl}/schedule`, icon: <AuditIcon /> },
      { label: "Help", href: `${baseUrl}/help`, icon: <SubmissionIcon /> },
      {
        label: "Settings",
        href: `${baseUrl}/settings`,
        icon: <SettingsIcon />,
      },
    ];
  }

  if (role === "FACULTY") {
    return [
      {
        label: "Dashboard",
        href: `${baseUrl}/dashboard`,
        icon: <DashboardIcon />,
      },
      { label: "Courses", href: `${baseUrl}/courses`, icon: <BookIcon /> },
      {
        label: "Assignments",
        href: `${baseUrl}/assignments`,
        icon: <AssignmentIcon />,
      },
      {
        label: "Submissions",
        href: `${baseUrl}/submissions`,
        icon: <SubmissionIcon />,
      },
      { label: "Grading", href: `${baseUrl}/grading`, icon: <GradeIcon /> },
      { label: "Reports", href: `${baseUrl}/reports`, icon: <ReportIcon /> },
    ];
  }

  // ADMIN
  return [
    {
      label: "Dashboard",
      href: `${baseUrl}/dashboard`,
      icon: <DashboardIcon />,
    },
    { label: "Users", href: `${baseUrl}/users`, icon: <UsersIcon /> },
    { label: "Students", href: `${baseUrl}/students`, icon: <UsersIcon /> },
    { label: "Faculty", href: `${baseUrl}/faculty`, icon: <UsersIcon /> },
    { label: "Courses", href: `${baseUrl}/courses`, icon: <BookIcon /> },
    {
      label: "Assignments",
      href: `${baseUrl}/assignments`,
      icon: <AssignmentIcon />,
    },
    {
      label: "Languages",
      href: `${baseUrl}/languages`,
      icon: <SettingsIcon />,
    },
    { label: "Security", href: `${baseUrl}/security`, icon: <AuditIcon /> },
    { label: "Reports", href: `${baseUrl}/reports`, icon: <ReportIcon /> },
    { label: "Settings", href: `${baseUrl}/settings`, icon: <SettingsIcon /> },
  ];
};

const getRoleBadgeColor = (role: UserRole) => {
  switch (role) {
    case "ADMIN":
      return "bg-red-100 text-red-800";
    case "FACULTY":
      return "bg-blue-100 text-blue-800";
    case "STUDENT":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getUserSettingsPath = (role: UserRole): string => {
  switch (role) {
    case "STUDENT":
      return "/student/settings";
    case "FACULTY":
      return "/faculty/settings";
    case "ADMIN":
      return "/admin/settings";
    default:
      return "/login";
  }
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return null;

  const navItems = getNavItems(user.role);

  const handleLogout = () => {
    logout();
  };

  const userMenuItems = [
    {
      label: "Settings",
      value: "settings",
      icon: <SettingsIcon />,
      onClick: () => router.push(getUserSettingsPath(user.role)),
    },
    { divider: true },
    {
      label: "Sign Out",
      value: "logout",
      icon: <LogoutIcon />,
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white shadow-xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo Section */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
          <Link
            href={`/${user.role.toLowerCase()}/dashboard`}
            className="flex items-center gap-3"
          >
            <div className="h-10 w-10 overflow-hidden rounded-lg bg-[#862733] flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Kriterion"
                width={28}
                height={28}
                className="object-contain"
              />
            </div>
            <span className="text-xl font-bold text-gray-900">Kriterion</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 lg:hidden"
          >
            <CloseIcon />
          </button>
        </div>

        {/* User Info */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#862733] flex items-center justify-center text-white font-semibold">
              {user.full_name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">
                {user.full_name}
              </p>
              <p className="truncate text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeColor(user.role)}`}
            >
              {user.role}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#862733] text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span className={isActive ? "text-white" : "text-gray-500"}>
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout Button */}
        <div className="border-t border-gray-200 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <LogoutIcon />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 shadow-sm lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
          >
            <MenuIcon />
          </button>

          <div className="flex-1" />

          {/* Right side of header */}
          <div className="flex items-center gap-4">
            {/* Notifications - placeholder */}
            <button className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
            </button>

            {/* User menu */}
            <Dropdown
              align="right"
              items={userMenuItems}
              trigger={
                <button
                  className="flex items-center gap-2 rounded-full px-2 py-1 text-sm text-gray-700 hover:bg-gray-100"
                  aria-label="Open user menu"
                >
                  <span className="hidden sm:inline">{user.full_name}</span>
                  <div className="h-8 w-8 rounded-full bg-[#862733] flex items-center justify-center text-white text-sm font-semibold">
                    {user.full_name?.charAt(0).toUpperCase() || "U"}
                  </div>
                </button>
              }
            />
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
