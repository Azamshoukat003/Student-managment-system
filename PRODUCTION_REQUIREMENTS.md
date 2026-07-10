# Final Year Project Requirements: Zero-Cost Face Attendance System

## 1. Project Summary

Build a simple zero-cost attendance management system for a final year project.

The application will allow teachers to create GPS-restricted attendance sessions. Students will log in, allow camera and location access, and mark attendance using face recognition. Attendance data will be stored in Neon PostgreSQL.

Recommended stack:

- Frontend: React
- Backend: Python
- Database: Neon PostgreSQL free tier
- Face recognition: Python-based face embedding/recognition
- Location check: Browser GPS radius/geofencing
- Hosting: Free-tier hosting if needed

## 2. Main Objective

The system should verify two things before saving attendance:

```text
1. Identity: Is this the correct logged-in student?
2. Presence: Is the student inside the allowed classroom/campus radius?
```

Final attendance rule:

```text
A student can mark attendance only if they are logged in, the attendance session is open, their GPS location is inside the allowed radius, their face matches their logged-in account, and they have not already marked attendance for that session.
```

## 3. User Roles

Use only three roles to keep the project simple.

### 3.1 Admin

Admin can:

- Login
- Manage students
- Manage teachers
- Manage classes
- Manage subjects
- Assign teachers to classes/subjects
- View all attendance records
- Generate attendance reports
- Reset user passwords
- View dashboard analytics

### 3.2 Teacher

Teacher can:

- Login
- View assigned classes/subjects
- Create attendance sessions
- Set attendance location and radius
- View class attendance
- Mark attendance manually
- Approve or reject pending attendance, if enabled
- Generate class attendance reports

### 3.3 Student

Student can:

- Login
- Update own profile
- Register face
- Mark attendance using face recognition and GPS
- View own attendance records

## 4. Authentication Requirements

### 4.1 Login

The system must support login for Admin, Teacher, and Student.

Login fields:

- Email or registration number
- Password

Requirements:

- Passwords must be hashed.
- Users must have an active/inactive status.
- Inactive users cannot log in.
- After login, user should be redirected based on role.

### 4.2 User Registration

For the simple FYP version, user registration should be controlled by Admin.

Admin can create:

- Student accounts
- Teacher accounts

Required student fields:

- Full name
- Email
- Registration number
- Password
- Class/program
- Semester
- Status

Required teacher fields:

- Full name
- Email
- Password
- Department
- Status

### 4.3 Password Reset

To keep the system zero-cost, use admin-based password reset.

Flow:

```text
1. User asks admin to reset password.
2. Admin sets temporary password.
3. User logs in.
4. User changes password from profile page.
```

Email-based password reset can be added later as a future enhancement.

### 4.4 Update Profile

Users can update:

- Name
- Phone number, if used
- Profile image
- Password

Students should not be allowed to edit:

- Registration number
- Role
- Class
- Semester
- Attendance records

### 4.5 Delete Account

Admin can delete or deactivate users.

Recommended FYP behavior:

- Use deactivate instead of permanent delete.
- Deactivated users cannot log in.
- Deactivated students must not be recognized in live attendance.
- Face data for deleted/deactivated students should not be used for active recognition.

## 5. Attendance Logic

Attendance must be session-based.

This means students cannot mark attendance anytime. A teacher must first create an attendance session.

## 6. Teacher Attendance Session Flow

Teacher creates a session with:

- Class
- Subject
- Date
- Start time
- End time
- Late cutoff time, optional
- Location latitude
- Location longitude
- Allowed radius in meters

Example:

```text
Class: BSCS Semester 2
Subject: Artificial Intelligence
Date: 2026-07-09
Start time: 09:00
End time: 09:15
Late allowed until: 09:25
Latitude: 33.6844
Longitude: 73.0479
Allowed radius: 100 meters
```

Teacher should have two location options:

```text
1. Use my current location
2. Enter latitude/longitude manually
```

Recommended default radius:

```text
100 meters
```

## 7. Student Face Attendance Flow

Student flow:

```text
1. Student logs in.
2. Student opens Mark Attendance page.
3. System checks if an attendance session is open for the student's class.
4. Browser asks for location permission.
5. Browser asks for camera permission.
6. Frontend captures student GPS coordinates.
7. Frontend captures face image.
8. Backend checks GPS radius.
9. Backend checks face recognition.
10. Backend checks duplicate attendance.
11. Attendance is saved in Neon PostgreSQL.
12. Student sees success or rejection message.
```

## 8. Attendance Validation Rules

Before saving attendance, backend must check:

```text
1. Is the student logged in?
2. Is the student account active?
3. Does the student belong to this class/session?
4. Is the attendance session open?
5. Is current time inside the allowed attendance window?
6. Did the student send GPS coordinates?
7. Is the GPS accuracy acceptable?
8. Is the student inside the allowed radius?
9. Is a face detected?
10. Does the face match the logged-in student?
11. Has this student already marked attendance for this session?
```

If any check fails, attendance must not be saved.

## 9. GPS Radius Logic

The system will use browser geolocation.

React gets:

- Student latitude
- Student longitude
- GPS accuracy

Backend compares student location with session location.

Use Haversine formula to calculate distance.

Decision:

```text
If distance <= allowed radius, continue.
If distance > allowed radius, reject attendance.
```

Accuracy rule:

```text
If GPS accuracy is greater than 100 meters, reject attendance or ask student to retry.
```

Recommended values:

```text
Allowed radius: 100 meters
Maximum accepted GPS accuracy: 100 meters
```

Important limitation:

```text
GPS is zero-cost and good for FYP, but it can be spoofed. For a real production system, GPS should be combined with QR code, campus Wi-Fi, or hardware beacon.
```

## 10. Face Recognition Logic

The student must register face before marking attendance.

Face registration flow:

```text
1. Student logs in.
2. Student opens Face Registration page.
3. Camera opens.
4. System captures multiple face samples.
5. Backend creates face embedding.
6. Embedding is saved in Neon DB or secure storage.
7. Student face status becomes registered.
```

Face attendance rule:

```text
The recognized face must match the logged-in student's account.
```

Example:

```text
Logged-in student: 2021-CS-02
Recognized face: 2021-CS-05
Result: Reject attendance
```

This prevents one student from logging in and using another student's face.

## 11. Liveness Detection

For the FYP version, use simple liveness detection only if time allows.

Recommended simple options:

- Blink detection
- Head movement left/right

Minimum acceptable FYP behavior:

```text
Face recognition + GPS radius check
```

Better FYP behavior:

```text
Face recognition + GPS radius check + blink detection
```

Advanced anti-spoofing can be listed as future enhancement.

## 12. Mask Face Recognition

Mask-aware face recognition is not required for the first working version.

For this project, handle it as:

```text
Optional feature or future enhancement.
```

Reason:

- It increases ML complexity.
- It can reduce accuracy.
- It is not necessary for the core attendance flow.

## 13. Manual Attendance

Teacher can mark attendance manually.

Manual attendance fields:

- Session
- Student
- Status
- Reason
- Marked by teacher
- Marked time

Rules:

- Students cannot manually mark their own attendance.
- Manual attendance must require a reason.
- Manual attendance should be visible in reports as manual.

Manual status values:

- Present
- Late
- Absent

## 14. Approve / Reject Attendance

Keep this simple.

Recommended FYP behavior:

- Normal face + GPS attendance is automatically approved.
- Manual attendance is saved directly by teacher.
- Approval/rejection can be used only for doubtful cases.

Pending attendance can be created when:

- Face confidence is low.
- GPS accuracy is weak.
- Teacher wants manual review.

Teacher/Admin can:

- Approve pending attendance
- Reject pending attendance
- Add comment

## 15. Attendance Status Logic

Attendance status should be calculated using time.

Example:

```text
Session start: 09:00
Session end: 09:15
Late cutoff: 09:25
```

Result:

```text
Before 09:00 = rejected, session not started
09:00 to 09:15 = present
09:16 to 09:25 = late
After 09:25 = rejected, session closed
```

## 16. Reports

The system must generate simple attendance reports.

Required reports:

- Student own attendance report
- Teacher class attendance report
- Admin full attendance report
- Date-wise attendance report
- Subject-wise attendance report

Export:

- CSV export is required.
- PDF export is optional.

Filters:

- Date range
- Class
- Subject
- Student
- Status

## 17. Dashboard Analytics

Keep dashboard analytics simple.

### Admin Dashboard

Show:

- Total students
- Total teachers
- Total classes
- Total attendance sessions
- Today's attendance count
- Present/late/absent summary

### Teacher Dashboard

Show:

- Assigned classes
- Today's sessions
- Present count
- Late count
- Absent count
- Recent attendance records

### Student Dashboard

Show:

- Attendance percentage
- Present count
- Late count
- Absent count
- Recent attendance records

## 18. Database Requirements: Neon PostgreSQL

Use Neon PostgreSQL free tier.

Required tables:

```text
users
classes
subjects
teacher_classes
face_embeddings
attendance_sessions
attendance_records
```

Optional table:

```text
activity_logs
```

## 19. Suggested Database Design

### users

Stores admin, teacher, and student accounts.

Main fields:

```text
id
full_name
email
password_hash
role
registration_number
department
class_id
semester
is_active
face_registered
created_at
updated_at
```

### classes

```text
id
name
program
semester
created_at
updated_at
```

### subjects

```text
id
name
code
class_id
created_at
updated_at
```

### teacher_classes

```text
id
teacher_id
class_id
subject_id
created_at
```

### face_embeddings

```text
id
student_id
embedding
image_path
is_active
created_at
updated_at
```

### attendance_sessions

```text
id
teacher_id
class_id
subject_id
session_date
start_time
end_time
late_cutoff_time
latitude
longitude
allowed_radius_meters
status
created_at
updated_at
```

Session status values:

```text
open
closed
cancelled
```

### attendance_records

```text
id
session_id
student_id
status
method
confidence_score
latitude
longitude
gps_accuracy
distance_from_session
approval_status
marked_by
marked_at
reason
created_at
updated_at
```

Attendance status values:

```text
present
late
absent
pending
rejected
```

Method values:

```text
face
manual
```

Approval status values:

```text
approved
pending
rejected
```

## 20. Backend Requirements: Python

Recommended backend:

```text
FastAPI
```

Alternative:

```text
Flask
```

FastAPI is recommended for the new version because it gives better API structure and automatic API docs.

Backend responsibilities:

- Authentication
- Role-based access
- User management
- Class and subject management
- Face registration
- Face recognition
- GPS radius validation
- Attendance sessions
- Attendance records
- Manual attendance
- Reports
- Dashboard APIs

## 21. Frontend Requirements: React

Required pages:

- Login
- Admin dashboard
- Teacher dashboard
- Student dashboard
- Manage users
- Manage classes
- Manage subjects
- Face registration
- Mark attendance
- Attendance sessions
- Manual attendance
- Attendance records
- Reports
- Profile

Frontend responsibilities:

- Login and logout
- Role-based routing
- Camera access
- Location permission
- Face capture
- Send attendance request to backend
- Show success/error messages
- Show reports and dashboard charts

## 22. API Requirements

Suggested API groups:

```text
/api/auth
/api/users
/api/classes
/api/subjects
/api/face
/api/attendance-sessions
/api/attendance-records
/api/reports
/api/dashboard
```

Important APIs:

```text
POST /api/auth/login
POST /api/auth/logout
GET /api/auth/me

POST /api/users
GET /api/users
PUT /api/users/:id
DELETE /api/users/:id

POST /api/face/register
POST /api/face/recognize

POST /api/attendance-sessions
GET /api/attendance-sessions/active
PUT /api/attendance-sessions/:id/close

POST /api/attendance-records/mark-face
POST /api/attendance-records/manual
GET /api/attendance-records

GET /api/reports/attendance
GET /api/dashboard/summary
```

## 23. Zero-Cost Tools

Use free tools:

```text
Neon PostgreSQL free tier
React
Python
FastAPI or Flask
OpenCV
face-recognition or DeepFace/FaceNet
Browser Geolocation API
CSV export
GitHub
Free deployment if required
```

Avoid paid services in the first version:

```text
Paid SMS
Paid email service
Paid map API
Paid biometric API
Paid monitoring tools
Paid cloud storage
```

## 24. Security Requirements

Simple but necessary security:

- Hash passwords.
- Use JWT or secure sessions.
- Protect API routes by role.
- Validate file uploads.
- Do not allow inactive users to log in.
- Do not allow deleted/deactivated students to be recognized.
- Store database URL in environment variable.
- Do not hardcode Neon credentials in code.

## 25. Data Backup and Recovery

For FYP, keep this simple.

Backup options:

- Export attendance records as CSV.
- Use Neon database backup/branching features if available.
- Add an admin button to export key data.

Required backup feature:

```text
Admin can export attendance data as CSV.
```

Optional:

```text
Admin can export all users, classes, sessions, and attendance data as CSV.
```

## 26. Activity Logs

Keep logs simple.

Log important actions:

- User login
- Face registration
- Attendance marked
- Manual attendance marked
- Attendance session created
- User deactivated

Activity logs are optional for the first version but useful for project demonstration.

## 27. Development Phases

### Phase 1: Backend and Database

- Create FastAPI/Flask backend.
- Connect Neon PostgreSQL.
- Create database tables.
- Implement login.
- Implement roles.
- Implement users/classes/subjects.

### Phase 2: React Frontend

- Create React app.
- Implement login page.
- Implement role-based dashboards.
- Implement admin user management.
- Implement teacher class/session pages.
- Implement student attendance page.

### Phase 3: Attendance Sessions

- Teacher creates attendance session.
- Teacher sets location/radius.
- Student can see active session.
- Backend validates session time.

### Phase 4: GPS Radius Check

- React captures student location.
- Backend calculates distance.
- Backend rejects if outside radius.
- Store location and distance in attendance record.

### Phase 5: Face Recognition

- Student registers face.
- Backend stores face embedding.
- Student marks attendance with camera.
- Backend verifies face matches logged-in student.

### Phase 6: Reports and Polish

- Attendance records page.
- CSV report export.
- Dashboard counts/charts.
- Manual attendance.
- Profile update.

## 28. Future Enhancements

These features can be mentioned in documentation but are not required for the first working version:

- Email password reset
- Advanced AI liveness detection
- Mask-aware face recognition
- QR code attendance token
- Campus Wi-Fi verification
- Mobile app
- PDF reports
- Full audit log system
- Automated cloud backup
- Advanced analytics

## 29. Final Project Scope Statement

Final scope:

```text
A zero-cost web-based attendance system using React, Python, and Neon PostgreSQL. Teachers create GPS-restricted attendance sessions. Students log in and mark attendance using face recognition and browser GPS. The backend verifies location radius, face identity, session time, and duplicate attendance before saving the record. Admins manage users/classes, teachers manage sessions and reports, and students view their own attendance.
```
