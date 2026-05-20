-- Safe performance indexes for Supabase/Vercel read-heavy routes.
-- These are non-destructive and can be re-run safely if a previous deploy
-- already created some of the indexes outside Prisma.

CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

CREATE INDEX IF NOT EXISTS "DoctorProfile_hospitalId_idx" ON "DoctorProfile"("hospitalId");
CREATE INDEX IF NOT EXISTS "DoctorProfile_specialty_idx" ON "DoctorProfile"("specialty");
CREATE INDEX IF NOT EXISTS "DoctorProfile_online_idx" ON "DoctorProfile"("online");

CREATE INDEX IF NOT EXISTS "Department_hospitalId_idx" ON "Department"("hospitalId");

CREATE INDEX IF NOT EXISTS "Appointment_patientId_idx" ON "Appointment"("patientId");
CREATE INDEX IF NOT EXISTS "Appointment_doctorId_idx" ON "Appointment"("doctorId");
CREATE INDEX IF NOT EXISTS "Appointment_status_idx" ON "Appointment"("status");
CREATE INDEX IF NOT EXISTS "Appointment_scheduledAt_idx" ON "Appointment"("scheduledAt");
CREATE INDEX IF NOT EXISTS "Appointment_patientId_doctorId_idx" ON "Appointment"("patientId", "doctorId");
CREATE INDEX IF NOT EXISTS "Appointment_patientId_scheduledAt_idx" ON "Appointment"("patientId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "Appointment_doctorId_scheduledAt_idx" ON "Appointment"("doctorId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "Appointment_doctorId_status_scheduledAt_idx" ON "Appointment"("doctorId", "status", "scheduledAt");

CREATE INDEX IF NOT EXISTS "Consultation_patientId_idx" ON "Consultation"("patientId");
CREATE INDEX IF NOT EXISTS "Consultation_doctorId_idx" ON "Consultation"("doctorId");

CREATE INDEX IF NOT EXISTS "LabResult_patientId_idx" ON "LabResult"("patientId");

CREATE INDEX IF NOT EXISTS "ChatRoom_patientId_idx" ON "ChatRoom"("patientId");
CREATE INDEX IF NOT EXISTS "ChatRoom_doctorId_idx" ON "ChatRoom"("doctorId");
CREATE INDEX IF NOT EXISTS "ChatRoom_patientId_doctorId_idx" ON "ChatRoom"("patientId", "doctorId");
CREATE INDEX IF NOT EXISTS "ChatRoom_patientId_doctorId_createdAt_idx" ON "ChatRoom"("patientId", "doctorId", "createdAt");

CREATE INDEX IF NOT EXISTS "Message_roomId_idx" ON "Message"("roomId");
CREATE INDEX IF NOT EXISTS "Message_roomId_createdAt_idx" ON "Message"("roomId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_senderId_idx" ON "Message"("senderId");

CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "VideoCall_patientId_idx" ON "VideoCall"("patientId");
CREATE INDEX IF NOT EXISTS "VideoCall_doctorId_idx" ON "VideoCall"("doctorId");
CREATE INDEX IF NOT EXISTS "VideoCall_status_idx" ON "VideoCall"("status");
CREATE INDEX IF NOT EXISTS "VideoCall_doctorId_status_idx" ON "VideoCall"("doctorId", "status");
CREATE INDEX IF NOT EXISTS "VideoCall_status_startedAt_idx" ON "VideoCall"("status", "startedAt");

CREATE INDEX IF NOT EXISTS "AiMessage_conversationId_idx" ON "AiMessage"("conversationId");
