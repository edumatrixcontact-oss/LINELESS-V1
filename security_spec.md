# LINELESS Security Specification (Phase 0)

## 1. Data Invariants
1. **Role Integrity**: Public registration (`/users/{userId}`) can ONLY create documents with `role == 'visitor'` and `uid == request.auth.uid`. Visitors can never modify `role` or `uid`. Staff permissions are derived strictly from `/staff/{uid}` or verified admin email (`thejashwinin61@gmail.com` with `email_verified == true`).
2. **PII Isolation**: `/users/{userId}` (containing `email`) is readable only by the owning user or authorized staff. `/tickets/{ticketId}` (containing `userId` and `visitorName`) is readable only by the owning visitor (`resource.data.userId == request.auth.uid`) or authorized staff. Public waiting-room displays read `/queueFeed/{ticketId}`, which contains zero PII.
3. **Unified Queue Atomicity**: Every ticket creation or status transition atomically synchronizes `/tickets/{ticketId}` and `/queueFeed/{ticketId}` using `existsAfter`/`getAfter` checks.
4. **Visitor Ticket Bounds**: Visitors may only create `digital` tickets in `waiting` status assigned to their own `request.auth.uid`, and may only transition their own `waiting` ticket to `cancelled`. Calling, serving, completing, deferring, re-queuing, pausing queues, issuing walk-ins, and broadcasting announcements are restricted to `isStaff()`.
5. **User-Scoped Notifications & Support**: Visitors can list and read only notifications (`resource.data.userId == request.auth.uid`) and support threads (`resource.data.userId == request.auth.uid`) belonging to their own UID.
6. **Temporal Integrity & Size Bounds**: Every string field has strict `.size()` caps, IDs match `^[a-zA-Z0-9_\-]+$`, and `createdAt`/`updatedAt` timestamps are validated against `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Assigned Staff Role**: Visitor creates `/users/u1` with `{ role: 'staff', ... }` -> **REJECTED** (`incoming().role == 'visitor'`).
2. **Role Escalation Update**: Visitor updates `/users/u1` changing `role` to `'staff'` -> **REJECTED** (`affectedKeys().hasOnly(['name', 'emailNotificationsEnabled', 'updatedAt'])`).
3. **Unverified Admin Email Spoof**: User with unverified email `thejashwinin61@gmail.com` (`email_verified: false`) attempts staff write -> **REJECTED** (`email_verified == true` required).
4. **Cross-User Ticket Read/List**: Visitor A queries `/tickets` without `where('userId', '==', uidA)` or reads Visitor B's ticket -> **REJECTED** (`resource.data.userId == request.auth.uid`).
5. **Cross-User Ticket Forgery**: Visitor A creates ticket with `userId: 'victim_uid'` -> **REJECTED** (`incoming().userId == request.auth.uid`).
6. **Ticket Status Shortcutting**: Visitor updates their own ticket directly from `waiting` to `called` or `completed` -> **REJECTED** (visitors can only transition `waiting -> cancelled`).
7. **Shadow Ghost Field Injection**: Client sends `{ ...validPayload, isVerified: true }` on create/update -> **REJECTED** (`hasOnly(...)` key allowlists).
8. **ID Poisoning**: Client writes document with 500-char ID or invalid characters `../admin` -> **REJECTED** (`isValidId()`).
9. **Unauthorized Staff Operational Write**: Visitor attempts to pause `/services/general-clinic` or broadcast `/announcements` -> **REJECTED** (`isStaff()`).
10. **Client-Spoofed Timestamp**: Client creates ticket with `createdAt` set 10 years in the past to jump queue -> **REJECTED** (`incoming().createdAt == request.time`).
11. **Terminal State Tampering**: Visitor attempts to re-open a `completed` or `cancelled` ticket -> **REJECTED** (terminal state lock).
12. **Support Thread Hijack**: Visitor A attempts to read or post a message inside Visitor B's `/supportThreads/{threadId}/messages` -> **REJECTED** (Master Gate `get()` on parent thread verifies ownership).
