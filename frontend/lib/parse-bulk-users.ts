import * as XLSX from 'xlsx';

export type BulkUserRole = 'STUDENT' | 'FACULTY' | 'ASSISTANT' | 'ADMIN';

export interface BulkUserCreateInput {
    email: string;
    full_name: string;
    role: BulkUserRole;
    password: string;
    student_id?: string;
    is_active?: boolean;
    send_welcome_email?: boolean;
}

export interface BulkUserParseError {
    row: number;
    message: string;
}

export interface BulkUserParseResult {
    users: BulkUserCreateInput[];
    errors: BulkUserParseError[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES: BulkUserRole[] = ['STUDENT', 'FACULTY', 'ASSISTANT', 'ADMIN'];

const REQUIRED_HEADERS = ['email', 'full_name', 'role', 'password'];

function normalizeHeader(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
    if (!value || !value.trim()) return fallback;
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    return fallback;
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    result.push(current);
    return result;
}

function validateAndMapRows(rawRows: string[][]): BulkUserParseResult {
    if (rawRows.length === 0) {
        return {
            users: [],
            errors: [{ row: 1, message: 'Template is empty.' }],
        };
    }

    const normalizedHeaders = (rawRows[0] || []).map((cell) => normalizeHeader(String(cell || '')));
    const headerIndex = normalizedHeaders.reduce<Record<string, number>>((acc, header, index) => {
        if (header) acc[header] = index;
        return acc;
    }, {});

    const missingHeaders = REQUIRED_HEADERS.filter((header) => headerIndex[header] === undefined);
    if (missingHeaders.length > 0) {
        return {
            users: [],
            errors: [
                {
                    row: 1,
                    message: `Missing required header(s): ${missingHeaders.join(', ')}`,
                },
            ],
        };
    }

    const users: BulkUserCreateInput[] = [];
    const errors: BulkUserParseError[] = [];

    for (let index = 1; index < rawRows.length; index++) {
        const row = rawRows[index] || [];
        const rowNumber = index + 1;

        const email = String(row[headerIndex.email] ?? '').trim().toLowerCase();
        const fullName = String(row[headerIndex.full_name] ?? '').trim();
        const roleRaw = String(row[headerIndex.role] ?? '').trim().toUpperCase();
        const password = String(row[headerIndex.password] ?? '').trim();
        const studentId = String(row[headerIndex.student_id] ?? '').trim();
        const isActiveRaw = String(row[headerIndex.is_active] ?? '').trim();
        const sendWelcomeRaw = String(row[headerIndex.send_welcome_email] ?? '').trim();

        const isEmptyRow = [email, fullName, roleRaw, password, studentId, isActiveRaw, sendWelcomeRaw]
            .every((value) => !value);

        if (isEmptyRow) {
            continue;
        }

        if (!email || !EMAIL_REGEX.test(email)) {
            errors.push({ row: rowNumber, message: 'Invalid or missing email.' });
            continue;
        }

        if (!fullName) {
            errors.push({ row: rowNumber, message: 'Full name is required.' });
            continue;
        }

        if (!VALID_ROLES.includes(roleRaw as BulkUserRole)) {
            errors.push({
                row: rowNumber,
                message: 'Role must be one of STUDENT, FACULTY, ASSISTANT, ADMIN.',
            });
            continue;
        }

        if (!password) {
            errors.push({ row: rowNumber, message: 'Password is required.' });
            continue;
        }

        if (roleRaw === 'STUDENT' && !studentId) {
            errors.push({ row: rowNumber, message: 'Student ID is required when role is STUDENT.' });
            continue;
        }

        users.push({
            email,
            full_name: fullName,
            role: roleRaw as BulkUserRole,
            password,
            student_id: studentId || undefined,
            is_active: parseBoolean(isActiveRaw, true),
            send_welcome_email: parseBoolean(sendWelcomeRaw, true),
        });
    }

    return { users, errors };
}

export async function parseBulkUsersFromFile(file: File): Promise<BulkUserParseResult> {
    const extension = (file.name || '').toLowerCase().split('.').pop();

    if (extension === 'csv') {
        const text = await file.text();
        const rows = text
            .split(/\r?\n/)
            .filter((line) => line.trim().length > 0)
            .map((line) => parseCSVLine(line));
        return validateAndMapRows(rows);
    }

    if (extension === 'xlsx' || extension === 'xls') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
            return {
                users: [],
                errors: [{ row: 1, message: 'Spreadsheet has no sheets.' }],
            };
        }

        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
            header: 1,
            defval: '',
            raw: false,
        }) as string[][];

        return validateAndMapRows(rows);
    }

    return {
        users: [],
        errors: [{ row: 1, message: 'Unsupported file type. Use .csv, .xlsx, or .xls.' }],
    };
}