import Link from 'next/link';

const tabs = [
    { key: 'overview', label: 'Overview', path: '' },
    { key: 'assignments', label: 'Assignments', path: '/assignments' },
    { key: 'students', label: 'Students', path: '/students' },
    { key: 'assistants', label: 'Assistants', path: '/assistants' },
    { key: 'reports', label: 'Reports', path: '/reports' },
] as const;

type FacultyCourseNavProps = {
    courseId: number;
    active: (typeof tabs)[number]['key'];
};

export function FacultyCourseNav({ courseId, active }: FacultyCourseNavProps) {
    return (
        <div className="flex flex-wrap gap-2 rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
            {tabs.map((tab) => {
                const isActive = tab.key === active;
                const href = `/faculty/courses/${courseId}${tab.path}`;

                return (
                    <Link
                        key={tab.key}
                        href={href}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </div>
    );
}