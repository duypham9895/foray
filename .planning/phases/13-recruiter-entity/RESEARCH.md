# Research: Phase 13 - Recruiter Entity

**Phase**: Full-3  
**Goal**: Track recruiters and their involvement across multiple applications  
**Date**: 2026-05-09

---

## Problem Being Solved

**Current state**: Recruiters are implicit in emails but not tracked as entities. User must manually track which recruiters they've worked with before.

**Friction points**:
- Cannot see all applications from same recruiter
- No history of interactions with each recruiter
- No way to rate recruiters (responsive, professional, etc.)
- Cannot track recruiter contact info (email, phone, LinkedIn)

**Solution**: Recruiter entity as first-class data:
- Create recruiter record on first email
- Auto-link recruiters to applications
- Track recruiter metadata (email, phone, company)
- View all applications from one recruiter
- Add notes to recruiter record

---

## Schema Design

**Recruiter entity**:
```prisma
model Recruiter {
  id Int @id @default(autoincrement())
  userId String  // multi-tenant key
  
  // Identity
  email String   // Primary identifier (de-duplicated)
  name String?   // "John Smith"
  phone String?
  linkedInUrl String?
  
  // Metadata
  company String?  // Recruiting firm or in-house recruiter
  notes String?    // User notes about recruiter
  
  // Relationships
  emails Email[]      // All emails from this recruiter
  applications Application[]  // All applications via this recruiter (many-to-many)
  
  // Audit
  firstContactAt DateTime @default(now())
  lastContactAt DateTime
  
  @@unique([userId, email])  // No duplicate recruiters per user
  @@index([userId])
}

// Junction table for recruiter ↔ application
model ApplicationRecruiter {
  id Int @id @default(autoincrement())
  applicationId Int
  recruiterId Int
  
  application Application @relation(fields: [applicationId], references: [id])
  recruiter Recruiter @relation(fields: [recruiterId], references: [id])
  
  @@unique([applicationId, recruiterId])
  @@index([recruiterId])  // Find all apps from recruiter
}
```

---

## Auto-Detection Flow

**When email arrives from recruiter:**

1. **Extract sender email** from Email.from field
2. **Lookup existing Recruiter** by (userId, email)
3. **If not found**: Create Recruiter record with extracted name from email
4. **Parse recruiter details** from email headers:
   - `name` → Extract from "From: John Smith <john@example.com>"
   - `company` → From email signature (rule-based extraction)
   - `phone` → From email signature (regex: `+1-xxx-xxx-xxxx`)
5. **Link application** → Create ApplicationRecruiter junction record

**Details extraction is optional** (can be user-edited later).

---

## Deduplication Strategy

**Challenge**: Same recruiter may have multiple email addresses.
- "john@recruits.io" and "john.smith@recruits.io" are same person

**Solution: User-driven deduplication**
- Phase 13 creates recruiters based on email address (exact match)
- UI shows "Possible duplicates: 3 recruiters with name 'John Smith'"
- User can manually merge: `POST /api/recruiters/:id1/merge/:id2`
- Merge operation:
  - Keep recruiter :id1
  - Update all emails + applications to point to :id1
  - Delete recruiter :id2

**Future enhancement (Full-6)**: ML-based deduplication using name + company similarity.

---

## Email Linking

**Current email flow** (from Phase 4):
```
Email arrives → classify → match to Application
```

**Phase 13 enhancement**:
```
Email arrives → extract recruiter → create/link Recruiter → classify → match to Application
```

**Classifier improvement**: When matching application, also link recruiter if email is from one.

---

## Recruiter View

**New UI page**: `/recruiters` showing:
- List of all recruiters (sorted by last contact)
- Search/filter by name, email, company
- Click recruiter → see all applications + email history

**Recruiter detail page** `/recruiters/:id`:
- Name, email, phone, LinkedIn URL (editable)
- Notes field (user-written)
- All applications from this recruiter (table)
- Email thread (all emails from this recruiter in chronological order)
- Rating field (optional, 1-5 stars)

---

## API Endpoints

- `GET /api/recruiters` → List all recruiters for user
- `GET /api/recruiters/:id` → Recruiter detail + applications
- `POST /api/recruiters` → Create manually
- `PUT /api/recruiters/:id` → Update name, notes, phone, LinkedIn
- `POST /api/recruiters/:id1/merge/:id2` → Merge duplicate recruiters
- `DELETE /api/recruiters/:id` → Soft-delete (if no applications reference)

---

## Privacy & Data Handling

**Recruiter data includes PII** (name, email, phone, LinkedIn).

**Handling**:
- Store encrypted (like OAuth refresh token)
- Never log to classifier logs
- Respect GDPR (allow deletion of recruiter data)
- Don't expose recruiter data in APIs unless authorized

---

*Phase 13 tracks people. Enables better workflow visibility and relationship management.*
