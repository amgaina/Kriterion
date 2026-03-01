import * as XLSX from 'xlsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(s: string): boolean {
    const trimmed = s.trim().toLowerCase();
    return !!trimmed && EMAIL_REGEX.test(trimmed);
}

function extractEmails(text: string): string[] {
    return text
        .split(/[\n,;\t]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => isValidEmail(e));
}

/**
 * Parse emails from an uploaded file (Excel, CSV, or TXT).
 * Excel/CSV: reads from column A (header "student email"), skips header row.
 * TXT: splits by newlines, commas, or semicolons.
 */
export async function parseEmailsFromFile(file: File): Promise<string[]> {
    const ext = (file.name || '').toLowerCase().split('.').pop();

    if (ext === 'txt') {
        const text = await file.text();
        return extractEmails(text);
    }

    if (ext === 'csv') {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((line) => line.trim());
        const emails: string[] = [];
        const header = (lines[0] || '').toLowerCase();
        const startRow = header.includes('email') ? 1 : 0;
        for (let i = startRow; i < lines.length; i++) {
            const cells = parseCSVLine(lines[i]);
            const cell = (cells[0] || '').trim().toLowerCase();
            if (isValidEmail(cell)) emails.push(cell);
        }
        return emails;
    }

    if (ext === 'xlsx' || ext === 'xls') {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const firstSheet = wb.SheetNames[0];
        if (!firstSheet) return [];
        const sheet = wb.Sheets[firstSheet];
        const data = XLSX.utils.sheet_to_json<string[]>(sheet, {
            header: 1,
            defval: '',
        }) as string[][];
        if (data.length === 0) return [];
        const headerRow = (data[0] || []).map((c) => String(c || '').toLowerCase());
        const emailColIndex = headerRow.findIndex((h) => h.includes('email')) ?? 0;
        const startRow = headerRow.some((h) => h.includes('email')) ? 1 : 0;
        const emails: string[] = [];
        for (let i = startRow; i < data.length; i++) {
            const row = data[i] || [];
            const cell = String(row[emailColIndex] ?? row[0] ?? '').trim().toLowerCase();
            if (isValidEmail(cell)) emails.push(cell);
        }
        return emails;
    }

    // Fallback: treat as text
    const text = await file.text();
    return extractEmails(text);
}

/** Simple CSV line parser - handles quoted values */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            inQuotes = !inQuotes;
        } else if ((c === ',' || c === '\t') && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += c;
        }
    }
    result.push(current);
    return result;
}
