# Kriterion - Use Cases Documentation

**Project:** Kriterion Automated Grading System  
**Version:** 1.0  
**Date:** February 3, 2026  
**Status:** Final

---

## Table of Contents

1. [Overview](#overview)
2. [Actors](#actors)
3. [Student Use Cases](#student-use-cases)
4. [Faculty Use Cases](#faculty-use-cases)
5. [Administrator Use Cases](#administrator-use-cases)
6. [System Use Cases](#system-use-cases)

---

## Overview

This document describes the use cases for the Kriterion Automated Grading System. Each use case details how different actors interact with the system to accomplish specific goals.

### Document Conventions

- **Actor:** The user or system performing the action
- **Precondition:** Requirements that must be met before the use case begins
- **Postcondition:** The state of the system after successful completion
- **Main Flow:** The typical sequence of steps
- **Alternative Flows:** Variations from the main flow
- **Exception Flows:** Error scenarios and how they're handled

---

## Actors

### Primary Actors

1. **Student** - A learner enrolled in courses who submits assignments and views grades
2. **Faculty** - An instructor who creates assignments, grades submissions, and manages courses
3. **Administrator** - A system admin who manages users, settings, and system maintenance

### Secondary Actors

4. **Sandbox Service** - Isolated execution environment for running student code
5. **Email System** - Sends notifications to users
6. **Database** - Stores all application data

---

## Student Use Cases

### UC-S1: Register for Account

**Actor:** Student  
**Goal:** Create a new account to access the system  
**Precondition:** Student has a valid email address  
**Postcondition:** Student account is created and awaiting activation

**Main Flow:**

1. Student navigates to registration page
2. Student enters email, full name, and password
3. System validates input (email format, password strength)
4. System checks if email already exists
5. System creates account with "Student" role
6. System sends verification email
7. System displays success message
8. Student verifies email via link
9. System activates account

**Alternative Flows:**

- **3a.** Invalid email format
  - System displays error message
  - Student corrects email and resubmits
- **3b.** Weak password
  - System shows password requirements
  - Student provides stronger password

**Exception Flows:**

- **4a.** Email already registered
  - System displays "Email already exists" message
  - Offers "Forgot Password" option

**Business Rules:**

- Password must be at least 8 characters
- Email must be unique in system
- Default role is "Student"

---

### UC-S2: Login to System

**Actor:** Student  
**Goal:** Access the system with credentials  
**Precondition:** Student has an active account  
**Postcondition:** Student is authenticated and redirected to dashboard

**Main Flow:**

1. Student navigates to login page
2. Student enters email and password
3. System validates credentials
4. System generates JWT access and refresh tokens
5. System stores tokens in secure cookies
6. System redirects to student dashboard
7. Dashboard displays active courses and assignments

**Alternative Flows:**

- **3a.** Incorrect credentials
  - System displays "Invalid email or password"
  - Student retries (max 5 attempts)
- **3b.** Account inactive
  - System displays "Account deactivated" message
  - Provides contact admin information

**Exception Flows:**

- **Rate limit exceeded**
  - System blocks login attempts for 15 minutes
  - Displays "Too many attempts" message

---

### UC-S3: View Assignments

**Actor:** Student  
**Goal:** See all available assignments for enrolled courses  
**Precondition:** Student is logged in and enrolled in at least one course  
**Postcondition:** Student views list of assignments with status

**Main Flow:**

1. Student navigates to "My Assignments" page
2. System retrieves all published assignments for student's courses
3. System displays assignments grouped by course
4. For each assignment, system shows:
   - Title and description
   - Due date and time remaining
   - Programming language
   - Maximum attempts allowed
   - Submission status (Not Started/In Progress/Submitted)
   - Score (if graded)
5. Student can filter by course or status
6. Student can sort by due date or name

**Alternative Flows:**

- **2a.** No assignments available
  - System displays "No assignments yet" message
- **5a.** Filter by specific course
  - System shows only assignments for selected course
- **5b.** Filter by status
  - System shows only assignments matching status

---

### UC-S4: Submit Assignment

**Actor:** Student  
**Goal:** Submit code solution for an assignment  
**Precondition:** Student is enrolled in course, assignment is published and not past due  
**Postcondition:** Submission is recorded and ready for grading

**Main Flow:**

1. Student selects assignment from list
2. System displays assignment details and rubric
3. System shows starter code (if provided)
4. Student uploads code file(s) or pastes code
5. System validates file format and size
6. Student clicks "Run Public Tests" (optional)
7. System executes public test cases in sandbox
8. System displays test results to student
9. Student reviews results and modifies code if needed
10. Student clicks "Submit for Grading"
11. System confirms submission
12. System records submission with timestamp
13. System increments attempt counter
14. System queues submission for autograding
15. System displays "Submitted successfully" message

**Alternative Flows:**

- **4a.** Multiple files required
  - Student uploads multiple files
  - System validates all files present
- **6a.** Public tests fail
  - Student fixes code and reruns tests
  - Continues until tests pass or decides to submit anyway
- **10a.** Max attempts reached
  - System prevents submission
  - Displays "Maximum attempts exceeded"

**Exception Flows:**

- **5a.** Invalid file format
  - System displays "Unsupported file type" error
  - Student uploads correct format
- **5b.** File size exceeds limit (50MB)
  - System displays "File too large" error
  - Student reduces file size
- **7a.** Sandbox timeout
  - System displays "Tests took too long to run"
  - Suggests code optimization

**Business Rules:**

- Maximum file size: 50MB
- Supported languages: Python, Java, C++, C, JavaScript, TypeScript
- Default max attempts: 3 (configurable per assignment)
- Late submissions not accepted after due date

---

### UC-S5: View Grades and Feedback

**Actor:** Student  
**Goal:** Review graded assignment results  
**Precondition:** Assignment has been submitted and graded  
**Postcondition:** Student has viewed scores and feedback

**Main Flow:**

1. Student navigates to "My Grades" page
2. System retrieves all graded submissions
3. System displays submissions with:
   - Assignment name
   - Submission date
   - Score (percentage and points)
   - Rubric breakdown by criteria
   - Test results (passed/failed)
   - Faculty comments (if any)
4. Student clicks on specific submission
5. System displays detailed grading report:
   - Each rubric criterion with score
   - Public test results (pass/fail/output)
   - Private test results (pass/fail only)
   - Line-by-line feedback (if provided)
   - Override justification (if score was manually adjusted)
6. Student can download full report as PDF

**Alternative Flows:**

- **3a.** No graded submissions
  - System displays "No grades available yet"
- **5a.** Assignment still pending grading
  - System shows "Grading in progress" status

---

### UC-S6: Download Grade Report

**Actor:** Student  
**Goal:** Export comprehensive grade report  
**Precondition:** Student has at least one graded submission  
**Postcondition:** PDF report is downloaded

**Main Flow:**

1. Student navigates to "My Progress" page
2. System displays overall statistics
3. Student clicks "Download Full Report"
4. System generates PDF with:
   - Student information
   - Course list
   - All assignment scores
   - Rubric breakdowns
   - Timeline of submissions
   - Grade trends chart
5. System downloads PDF to student's device

**Business Rules:**

- Report includes only completed courses
- GPA calculated on 4.0 scale if applicable
- Report includes institutional branding

---

### UC-S7: View Assignment Schedule

**Actor:** Student  
**Goal:** See upcoming assignment deadlines  
**Precondition:** Student is enrolled in courses  
**Postcondition:** Student views calendar of due dates

**Main Flow:**

1. Student navigates to "Schedule" page
2. System displays calendar view
3. System marks dates with assignment due dates
4. Student can switch between month/week/list view
5. Student clicks on date to see assignments due
6. System shows assignment details and time remaining

**Alternative Flows:**

- **5a.** Multiple assignments on same day
  - System lists all assignments for that date
  - Shows priority based on time remaining

---

## Faculty Use Cases

### UC-F1: Create New Assignment

**Actor:** Faculty  
**Goal:** Create programming assignment for students  
**Precondition:** Faculty is logged in and teaches at least one course  
**Postcondition:** Assignment is created in draft state

**Main Flow:**

1. Faculty navigates to "Assignments" page
2. Faculty clicks "Create New Assignment"
3. System displays assignment creation form
4. Faculty enters:
   - Title and description
   - Course and section
   - Programming language
   - Due date and time
   - Maximum attempts allowed
   - Starter code (optional)
   - Supporting files (optional)
5. Faculty defines rubric:
   - Adds rubric criteria (e.g., "Correctness", "Code Quality")
   - Assigns weight to each criterion (must sum to 100%)
   - Adds description for each criterion
6. Faculty uploads test cases:
   - Public tests (visible to students)
   - Private tests (hidden from students)
   - For each test: input, expected output, points
7. Faculty sets grading options:
   - Auto-grade immediately or manual trigger
   - Allow resubmissions
   - Sandbox timeout limit
8. Faculty clicks "Save Draft"
9. System validates all required fields
10. System creates assignment in "Draft" status
11. System displays success message

**Alternative Flows:**

- **5a.** Use default rubric template
  - Faculty selects "Use Default Template"
  - System loads standard rubric (Correctness 60%, Style 20%, Efficiency 20%)
- **6a.** Import tests from file
  - Faculty uploads CSV/JSON with test cases
  - System parses and validates test format
- **9a.** Validation fails
  - System highlights missing/invalid fields
  - Faculty corrects and resubmits

**Exception Flows:**

- **9a.** Rubric weights don't sum to 100%
  - System displays error message
  - Faculty adjusts weights

**Business Rules:**

- Minimum one rubric criterion required
- Rubric weights must sum to exactly 100%
- At least one test case required
- Maximum 50 test cases per assignment
- Starter code is optional but recommended

---

### UC-F2: Publish Assignment

**Actor:** Faculty  
**Goal:** Make assignment visible and available to students  
**Precondition:** Assignment exists in draft state with all required components  
**Postcondition:** Assignment is published and students can submit

**Main Flow:**

1. Faculty views assignment list
2. Faculty selects draft assignment
3. System displays assignment preview
4. Faculty reviews:
   - Assignment details
   - Rubric configuration
   - Test cases
   - Due date
5. Faculty clicks "Publish Assignment"
6. System validates assignment completeness
7. System changes status to "Published"
8. System notifies enrolled students via email/notification
9. System displays "Assignment published successfully"

**Alternative Flows:**

- **6a.** Assignment incomplete
  - System lists missing components
  - Faculty completes missing items
  - Returns to step 5

**Exception Flows:**

- **6a.** Due date in the past
  - System prevents publishing
  - Faculty updates due date

---

### UC-F3: View Submissions

**Actor:** Faculty  
**Goal:** Monitor student submissions for an assignment  
**Precondition:** Assignment is published  
**Postcondition:** Faculty views submission statistics

**Main Flow:**

1. Faculty navigates to "Grading" page
2. System displays assignments with submission counts
3. Faculty selects specific assignment
4. System displays submission list with:
   - Student name and ID
   - Submission timestamp
   - Attempt number
   - Grading status (Pending/Graded/Overridden)
   - Score (if graded)
   - Test pass rate
5. Faculty can filter by:
   - Grading status
   - Score range
   - Submission date
6. Faculty can sort by name, score, or date

**Alternative Flows:**

- **4a.** No submissions yet
  - System displays "No submissions yet"
  - Shows enrolled student count
- **5a.** Filter ungraded submissions
  - System shows only pending submissions

---

### UC-F4: Grade Submission

**Actor:** Faculty  
**Goal:** Review and grade a student's code submission  
**Precondition:** Student has submitted assignment  
**Postcondition:** Submission is graded with scores and feedback

**Main Flow:**

1. Faculty selects submission from list
2. System displays grading interface with:
   - Student code (syntax highlighted)
   - Test results (pass/fail for each test)
   - Auto-calculated rubric scores
   - Public and private test outputs
3. Faculty reviews auto-grading results
4. Faculty can:
   - Add inline comments to code
   - Provide general feedback
   - Adjust rubric scores manually
   - Override final score with justification
5. Faculty enters override reason (if applicable)
6. Faculty clicks "Submit Grade"
7. System saves grade and feedback
8. System sends notification to student
9. System updates assignment statistics

**Alternative Flows:**

- **3a.** Auto-grading failed
  - System shows error message
  - Faculty can manually trigger re-grading
  - Or manually assign scores
- **4a.** Plagiarism suspected
  - Faculty marks for review
  - Adds note to audit log
  - Can defer grading pending investigation

**Exception Flows:**

- **5a.** Override without justification
  - System requires justification text
  - Faculty provides reason
- **4a.** Code causes sandbox crash
  - System logs error
  - Faculty reviews logs and assigns score accordingly

**Business Rules:**

- All rubric criteria must have scores
- Override reason required if final score differs from auto-grade
- Faculty can re-grade unlimited times
- All grading actions logged in audit trail

---

### UC-F5: Override Grade

**Actor:** Faculty  
**Goal:** Manually adjust auto-generated grade  
**Precondition:** Submission has been auto-graded  
**Postcondition:** Grade is overridden with faculty justification

**Main Flow:**

1. Faculty views graded submission
2. Faculty clicks "Override Score"
3. System displays override form with:
   - Current auto-graded score
   - Rubric breakdown
   - Override reason field
4. Faculty adjusts individual rubric scores or total score
5. Faculty enters detailed justification
6. Faculty clicks "Save Override"
7. System validates justification is not empty
8. System updates score with "Overridden" badge
9. System logs override in audit trail
10. System notifies student of updated grade

**Business Rules:**

- Justification required (min 10 characters)
- Override logged with timestamp and faculty ID
- Students see override reason
- Cannot delete override, only update it

---

### UC-F6: Export Grades

**Actor:** Faculty  
**Goal:** Export course grades for Canvas/LMS integration  
**Precondition:** Course has graded assignments  
**Postcondition:** CSV file is downloaded

**Main Flow:**

1. Faculty navigates to "Reports" page
2. Faculty selects course
3. Faculty clicks "Export Grades"
4. System displays export options:
   - Format: Canvas CSV, Excel, PDF
   - Include: All students or only submitted
   - Date range
5. Faculty selects options and clicks "Generate"
6. System compiles data:
   - Student ID, Name, Email
   - Assignment scores
   - Total score
   - Letter grade (if configured)
7. System generates file in selected format
8. System downloads file to faculty's device

**Alternative Flows:**

- **4a.** Canvas format selected
  - System formats CSV per Canvas specification
  - Includes required Canvas column headers
- **4b.** Excel format
  - System generates .xlsx with formulas
  - Includes charts for grade distribution

---

### UC-F7: View Assignment Analytics

**Actor:** Faculty  
**Goal:** Analyze assignment performance and identify trends  
**Precondition:** Assignment has at least 5 submissions  
**Postcondition:** Faculty views statistical analysis

**Main Flow:**

1. Faculty selects assignment from list
2. Faculty clicks "View Analytics"
3. System displays dashboard with:
   - Submission timeline chart
   - Score distribution histogram
   - Average score per rubric criterion
   - Test case pass rates
   - Time-to-completion statistics
   - Common errors/patterns
4. Faculty can drill down into specific metrics
5. Faculty can filter by section or date range
6. Faculty can export analytics as PDF

**Alternative Flows:**

- **4a.** Identify struggling students
  - System highlights students scoring below 60%
  - Faculty can send targeted feedback
- **4b.** Identify problematic test cases
  - System shows tests with low pass rates
  - Faculty can review and adjust difficulty

---

### UC-F8: Manage Course Settings

**Actor:** Faculty  
**Goal:** Configure course-specific settings  
**Precondition:** Faculty teaches the course  
**Postcondition:** Course settings are updated

**Main Flow:**

1. Faculty navigates to course page
2. Faculty clicks "Course Settings"
3. System displays settings form:
   - Course name and code
   - Grading scale (A=90-100, B=80-89, etc.)
   - Late submission policy
   - Collaboration policy
   - Announcement preferences
4. Faculty modifies settings
5. Faculty clicks "Save Changes"
6. System validates settings
7. System updates course configuration
8. System displays confirmation message

---

## Administrator Use Cases

### UC-A1: Manage Users

**Actor:** Administrator  
**Goal:** Add, edit, or deactivate user accounts  
**Precondition:** Administrator is logged in  
**Postcondition:** User account is modified

**Main Flow:**

1. Admin navigates to "User Management" page
2. System displays user list with:
   - Name, Email, Role, Status
   - Last login date
   - Account creation date
3. Admin selects user to modify
4. System displays user details
5. Admin can:
   - Edit user information
   - Change role (Student/Faculty/Admin)
   - Activate/Deactivate account
   - Reset password
   - View user's activity history
6. Admin makes changes
7. Admin clicks "Save Changes"
8. System validates changes
9. System updates user record
10. System logs action in audit trail
11. System notifies user of changes (if applicable)

**Alternative Flows:**

- **5a.** Deactivate user
  - Admin clicks "Deactivate"
  - System prompts for confirmation
  - System marks account as inactive
  - User cannot log in
- **5b.** Reset password
  - Admin clicks "Reset Password"
  - System generates temporary password
  - System emails user with reset link
- **5c.** Bulk user import
  - Admin uploads CSV file with user data
  - System validates and creates accounts
  - System sends welcome emails

**Exception Flows:**

- **8a.** Email conflict
  - System displays "Email already exists"
  - Admin corrects email

**Business Rules:**

- Cannot delete users with graded submissions
- Can only deactivate (soft delete)
- Password reset link expires in 24 hours
- Role changes logged in audit trail

---

### UC-A2: View Audit Logs

**Actor:** Administrator  
**Goal:** Review system activity and security events  
**Precondition:** Administrator has audit log permissions  
**Postcondition:** Admin has reviewed relevant logs

**Main Flow:**

1. Admin navigates to "Audit Logs" page
2. System displays recent audit events
3. For each event, system shows:
   - Timestamp
   - User (who performed action)
   - Action type (Login, Grade Override, User Modified, etc.)
   - Resource affected (Assignment ID, User ID, etc.)
   - IP address
   - Status (Success/Failure)
   - Details (JSON payload)
4. Admin can filter by:
   - Date range
   - User
   - Action type
   - Status
5. Admin can search by keyword
6. Admin can export logs to CSV

**Alternative Flows:**

- **4a.** Filter security events
  - Admin selects "Failed Logins" filter
  - System shows authentication failures
  - Admin investigates suspicious patterns
- **4b.** Track specific user
  - Admin enters user email in search
  - System shows all actions by that user

**Business Rules:**

- Logs retained for 1 year
- Sensitive data (passwords) never logged
- IP addresses anonymized after 90 days for privacy

---

### UC-A3: Configure System Settings

**Actor:** Administrator  
**Goal:** Manage global system configuration  
**Precondition:** Administrator has system settings permission  
**Postcondition:** System settings are updated

**Main Flow:**

1. Admin navigates to "System Settings" page
2. System displays configuration categories:
   - Security Settings
   - Email Configuration
   - File Upload Limits
   - Sandbox Settings
   - Grading Defaults
   - Feature Flags
3. Admin selects category
4. System displays editable settings
5. Admin modifies values
6. Admin clicks "Save Settings"
7. System validates settings
8. System applies changes
9. System displays confirmation
10. System logs configuration change

**Alternative Flows:**

- **3a.** Security Settings
  - Password complexity requirements
  - Session timeout duration
  - Max login attempts
  - Token expiration times
- **3b.** Sandbox Settings
  - Memory limit (MB)
  - CPU time limit (seconds)
  - Disk space limit
  - Network access (enable/disable)
- **3c.** Email Configuration
  - SMTP server settings
  - Email templates
  - Notification preferences

**Exception Flows:**

- **7a.** Invalid value
  - System displays validation error
  - Admin corrects value
- **8a.** Setting requires restart
  - System warns admin
  - Admin confirms or cancels

**Business Rules:**

- Critical settings require confirmation
- Changes logged in audit trail
- Some settings require application restart

---

### UC-A4: Manage Programming Languages

**Actor:** Administrator  
**Goal:** Add or configure supported programming languages  
**Precondition:** Administrator has language configuration permission  
**Postcondition:** Programming language is available for assignments

**Main Flow:**

1. Admin navigates to "Languages" page
2. System displays configured languages with:
   - Name (Python, Java, etc.)
   - Version (3.11, 17, etc.)
   - Compiler/Interpreter path
   - Default timeout
   - Enabled/Disabled status
3. Admin clicks "Add Language"
4. System displays language configuration form
5. Admin enters:
   - Language name
   - Version
   - File extensions (.py, .java, etc.)
   - Execution command
   - Compilation command (if needed)
   - Sandbox image name
   - Memory limits
   - Timeout defaults
6. Admin clicks "Save Language"
7. System validates configuration
8. System tests language by running sample code
9. System enables language for assignment creation
10. System displays success message

**Alternative Flows:**

- **8a.** Language test fails
  - System displays error details
  - Admin adjusts configuration
  - Retries test
- **3a.** Disable language
  - Admin toggles language to "Disabled"
  - System prevents new assignments using that language
  - Existing assignments unaffected

**Business Rules:**

- Language name must be unique
- Must specify valid Docker image
- Test execution must succeed before enabling

---

### UC-A5: Monitor System Health

**Actor:** Administrator  
**Goal:** Monitor system performance and health metrics  
**Precondition:** Administrator is logged in  
**Postcondition:** Admin has viewed system status

**Main Flow:**

1. Admin navigates to "System Dashboard"
2. System displays real-time metrics:
   - Active users (current sessions)
   - Database connections
   - Sandbox container count
   - API response times
   - Error rates (last hour/day)
   - Disk usage
   - Memory usage
   - CPU utilization
3. System displays recent alerts/warnings
4. Admin can drill down into specific metrics
5. Admin can set alert thresholds
6. System notifies admin if threshold exceeded

**Alternative Flows:**

- **3a.** Critical alert present
  - System highlights alert in red
  - Admin investigates root cause
  - Admin takes corrective action
- **5a.** Configure alerts
  - Admin sets threshold (e.g., CPU > 80%)
  - System monitors metric
  - System emails admin when exceeded

---

### UC-A6: Generate System Reports

**Actor:** Administrator  
**Goal:** Generate comprehensive system usage reports  
**Precondition:** System has operational data  
**Postcondition:** Report is generated and downloaded

**Main Flow:**

1. Admin navigates to "Reports" page
2. System displays report types:
   - User Statistics (registrations, active users)
   - Assignment Statistics (total, by language)
   - Grading Statistics (submissions, completion rates)
   - System Performance (uptime, response times)
   - Security Report (failed logins, suspicious activity)
3. Admin selects report type
4. Admin sets parameters:
   - Date range
   - Format (PDF, CSV, Excel)
   - Include graphs
5. Admin clicks "Generate Report"
6. System compiles data
7. System generates formatted report
8. System downloads report to admin's device

**Alternative Flows:**

- **6a.** Large dataset
  - System queues report for background processing
  - System emails admin when ready
  - Admin downloads from email link

---

## System Use Cases

### UC-SYS1: Auto-Grade Submission

**Actor:** Grading Service (Background Process)  
**Goal:** Automatically evaluate student code against test cases  
**Precondition:** Submission queued for grading  
**Postcondition:** Submission is graded with test results and rubric scores

**Main Flow:**

1. System detects new submission in queue
2. System retrieves submission details:
   - Student code files
   - Assignment test cases
   - Rubric configuration
   - Language settings
3. System creates isolated sandbox container
4. System copies student code into sandbox
5. System compiles code (if compiled language)
6. System runs each test case:
   - Executes code with test input
   - Captures output and errors
   - Measures execution time and memory
   - Compares output with expected result
7. System records test results (pass/fail)
8. System calculates rubric scores:
   - Correctness: (passed tests / total tests) × weight
   - Other criteria: default scores (if auto-scored)
9. System calculates final score (weighted sum)
10. System stores results in database
11. System updates submission status to "Graded"
12. System destroys sandbox container
13. System notifies student of grade availability

**Alternative Flows:**

- **5a.** Compilation fails
  - System records compilation error
  - System assigns zero for correctness
  - System provides error message to student
  - Skips test execution
- **6a.** Test times out
  - System kills process after timeout
  - System marks test as "Failed - Timeout"
  - System continues with next test
- **6b.** Runtime error
  - System captures error/exception
  - System marks test as "Failed - Runtime Error"
  - System logs error details
- **6c.** Memory limit exceeded
  - System terminates process
  - System marks test as "Failed - Memory Limit"

**Exception Flows:**

- **3a.** Sandbox creation fails
  - System retries up to 3 times
  - If still fails, marks submission as "Grading Error"
  - Notifies administrator
- **6a.** Infinite loop detected
  - Timeout mechanism kills process
  - System records timeout failure

**Business Rules:**

- Default timeout: 30 seconds per test
- Memory limit: 512MB per sandbox
- Max 50 test cases per assignment
- Sandbox containers destroyed after use
- Failed tests provide error details

---

### UC-SYS2: Send Notification

**Actor:** Notification Service  
**Goal:** Send email/in-app notifications to users  
**Precondition:** Event triggers notification  
**Postcondition:** User receives notification

**Main Flow:**

1. System event occurs (submission graded, assignment published, etc.)
2. System determines affected users
3. System checks user notification preferences
4. System generates notification content
5. System sends email (if enabled)
6. System creates in-app notification
7. System marks notification as sent
8. System logs notification delivery

**Alternative Flows:**

- **3a.** User has emails disabled
  - System skips email delivery
  - Only creates in-app notification
- **5a.** Email delivery fails
  - System retries up to 3 times
  - Logs failure after retries exhausted

**Notification Types:**

- Assignment Published
- Submission Received
- Grading Completed
- Grade Override
- Due Date Reminder (24h before)
- Password Reset Request
- Account Activation

---

### UC-SYS3: Clean Up Old Data

**Actor:** System Maintenance Job (Scheduled)  
**Goal:** Archive or delete old data to maintain performance  
**Precondition:** Scheduled time reached  
**Postcondition:** Old data cleaned up

**Main Flow:**

1. System runs scheduled cleanup job (daily at 2 AM)
2. System identifies data for cleanup:
   - Expired refresh tokens (>7 days old)
   - Failed login attempts (>30 days old)
   - Old audit logs (>1 year old)
   - Orphaned file uploads (>90 days unused)
   - Inactive sandbox containers
3. System archives audit logs before deletion
4. System deletes expired/old records
5. System optimizes database (VACUUM)
6. System logs cleanup summary
7. System sends report to administrators

**Business Rules:**

- Submissions never deleted (academic records)
- User accounts soft-deleted (deactivated, not removed)
- Audit logs archived before deletion
- Cleanup runs during low-traffic hours

---

## Use Case Relationships

### Inheritance (Generalization)

- **UC-F1 (Create Assignment)** extends **UC-F2 (Publish Assignment)**
- **UC-F4 (Grade Submission)** extends **UC-F5 (Override Grade)**

### Include Relationships

- **UC-S4 (Submit Assignment)** includes **UC-SYS1 (Auto-Grade Submission)**
- **All grading UCs** include **UC-SYS2 (Send Notification)**
- **UC-A1 (Manage Users)** includes **UC-A2 (View Audit Logs)**

### Extend Relationships

- **UC-S5 (View Grades)** extends **UC-S6 (Download Report)**
- **UC-F3 (View Submissions)** extends **UC-F4 (Grade Submission)**

---

## Use Case Priority Matrix

| Priority          | Use Cases                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Critical (P0)** | UC-S2 (Login), UC-S4 (Submit Assignment), UC-SYS1 (Auto-Grade)                              |
| **High (P1)**     | UC-S1 (Register), UC-F1 (Create Assignment), UC-F4 (Grade Submission), UC-A1 (Manage Users) |
| **Medium (P2)**   | UC-S6 (Download Report), UC-F6 (Export Grades), UC-F7 (Analytics), UC-A2 (Audit Logs)       |
| **Low (P3)**      | UC-S7 (View Schedule), UC-F8 (Course Settings), UC-A4 (Manage Languages)                    |

---

## Use Case Traceability

Each use case maps to specific requirements and system components:

| Use Case | Requirements             | Backend Endpoint                            | Frontend Page                        |
| -------- | ------------------------ | ------------------------------------------- | ------------------------------------ |
| UC-S2    | REQ-AUTH-001             | POST /api/v1/auth/login                     | /login/page.tsx                      |
| UC-S4    | REQ-SUB-001, REQ-SUB-002 | POST /api/v1/submissions                    | /student/assignments/[id]/page.tsx   |
| UC-F1    | REQ-ASSIGN-001           | POST /api/v1/assignments                    | /faculty/assignments/create/page.tsx |
| UC-F4    | REQ-GRADE-001            | PUT /api/v1/submissions/{id}/override-score | /faculty/grading/page.tsx            |
| UC-A1    | REQ-ADMIN-001            | GET/PUT /api/v1/admin/users                 | /admin/users/page.tsx                |

---

## Testing Scenarios

Each use case should have corresponding test cases:

### Example: UC-S4 (Submit Assignment) Test Scenarios

1. **Happy Path:** Student submits valid code, all tests pass
2. **Late Submission:** Student attempts submission after due date
3. **Max Attempts:** Student reaches attempt limit
4. **Invalid File:** Student uploads wrong file type
5. **File Too Large:** Student uploads file exceeding limit
6. **Sandbox Timeout:** Student's code runs too long
7. **Compilation Error:** Student submits code that doesn't compile
8. **Network Failure:** Submission interrupted by network issue

---

## Revision History

| Version | Date       | Author             | Changes                    |
| ------- | ---------- | ------------------ | -------------------------- |
| 1.0     | 2026-02-03 | Documentation Team | Initial use cases document |

---

## Appendix: Glossary

- **Actor:** A person or system that interacts with the application
- **Use Case:** A description of how an actor uses the system to achieve a goal
- **Precondition:** State that must be true before a use case can begin
- **Postcondition:** State of the system after successful use case completion
- **Main Flow:** The typical, successful sequence of steps
- **Alternative Flow:** Variations from the main flow
- **Exception Flow:** Error handling and recovery procedures
- **Business Rule:** Constraints and policies governing system behavior
