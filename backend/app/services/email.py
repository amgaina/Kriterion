"""Email service for sending notifications."""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import settings
from app.core.logging import logger


def send_email(to: str, subject: str, body_html: str, body_text: str | None = None) -> bool:
    """Send an email. Returns True if sent, False otherwise."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured. Email not sent.")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.EMAIL_FROM
        msg["To"] = to
        if body_text:
            msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAIL_FROM, to, msg.as_string())
        logger.info(f"Email sent to {to}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return False


def send_student_add_request_to_admin(
    student_email: str,
    course_code: str,
    course_name: str,
    faculty_name: str,
    faculty_email: str,
) -> bool:
    """Notify admin that a faculty requested to add a student who is not in the system."""
    subject = f"[Kriterion] Student Add Request: {student_email}"
    body_text = (
        f"A faculty member has requested to enroll a student who is not yet in the system.\n\n"
        f"Student email: {student_email}\n"
        f"Course: {course_code} - {course_name}\n"
        f"Requested by: {faculty_name} ({faculty_email})\n\n"
        f"Please add this student to the system so they can be enrolled."
    )
    body_html = f"""
    <p>A faculty member has requested to enroll a student who is not yet in the system.</p>
    <ul>
        <li><strong>Student email:</strong> {student_email}</li>
        <li><strong>Course:</strong> {course_code} - {course_name}</li>
        <li><strong>Requested by:</strong> {faculty_name} ({faculty_email})</li>
    </ul>
    <p>Please add this student to the system so they can be enrolled in the course.</p>
    """
    return send_email(settings.INITIAL_ADMIN_EMAIL, subject, body_html, body_text)


def send_bulk_student_add_request_to_admin(
    not_found_emails: list[str],
    course_code: str,
    course_name: str,
    faculty_name: str,
    faculty_email: str,
) -> bool:
    """Notify admin about multiple students not in system after bulk enroll attempt."""
    if not not_found_emails:
        return True
    emails_list = "\n".join(f"  - {e}" for e in not_found_emails[:50])
    if len(not_found_emails) > 50:
        emails_list += f"\n  ... and {len(not_found_emails) - 50} more"
    subject = f"[Kriterion] Bulk Enroll: {len(not_found_emails)} students not in system"
    body_text = (
        f"Faculty attempted bulk enroll. These students are not in the system:\n\n{emails_list}\n\n"
        f"Course: {course_code} - {course_name}\n"
        f"Requested by: {faculty_name} ({faculty_email})\n\n"
        f"Please add these students to the system."
    )
    body_html = f"""
    <p>Faculty attempted bulk enroll. These students are not in the system:</p>
    <pre>{emails_list}</pre>
    <p><strong>Course:</strong> {course_code} - {course_name}</p>
    <p><strong>Requested by:</strong> {faculty_name} ({faculty_email})</p>
    <p>Please add these students to the system so they can be enrolled.</p>
    """
    return send_email(settings.INITIAL_ADMIN_EMAIL, subject, body_html, body_text)
