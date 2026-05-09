# Research: Phase 12 - Document Storage

**Phase**: Full-2  
**Goal**: Store and organize job application documents (resume versions, cover letters, offer letters)  
**Date**: 2026-05-09

---

## Problem Being Solved

**Current state**: Users store documents separately (Google Drive, local files, email attachments). No central place to attach documents to applications.

**Friction points**:
- Cannot find right resume version for each application
- Offer letters scattered across email
- No history of documents sent to each company
- Manual organization burden

**Solution**: Attach documents to applications:
- Upload resume/cover letter per application
- Attach offer letter when received
- Version history (track multiple resumes)
- Full-text search across documents

---

## Storage Architecture

**Cloud storage options**:
1. **Google Cloud Storage (GCS)**: Cheap ($0.020/GB), integrates with Google Auth
2. **AWS S3**: Similar pricing, more configuration
3. **Supabase Storage**: Built on S3, simpler API

**Decision for Phase 12**: Use **Supabase Storage** (built on S3, requires less setup).

**Bucket structure**:
```
foray/
├── users/{userId}/
│   ├── applications/{appId}/
│   │   ├── resume/
│   │   │   ├── resume-v1.pdf
│   │   │   └── resume-v2.pdf
│   │   ├── cover-letter/
│   │   │   └── cover-letter-2026-05-09.pdf
│   │   └── offer/
│   │       └── offer-letter.pdf
```

---

## File Upload Security

**Security measures**:
1. **Signed URLs**: Generate time-limited URLs for upload (user doesn't need API key)
2. **Virus scanning**: Run file through VirusTotal API before storing
3. **File type whitelist**: Only .pdf, .docx, .txt, .jpg, .png (no executables)
4. **File size limit**: Max 10MB per file (prevents abuse)
5. **Encryption at rest**: Supabase Storage encrypts automatically

**Upload flow**:
```
User selects file
  ↓ (client validates type + size)
POST /api/documents/upload-url
  ↓ (server generates signed URL)
Server returns signed URL + virus scan token
  ↓ (client uploads directly to Supabase)
POST /api/documents/scan (virus check)
  ↓ (server calls VirusTotal API)
If clean: save Document record in DB
```

---

## Document Schema

**Prisma model**:
```prisma
model Document {
  id Int @id @default(autoincrement())
  applicationId Int
  application Application @relation(fields: [applicationId], references: [id])
  
  fileName String
  fileType String  // 'resume', 'cover_letter', 'offer_letter', 'other'
  mimeType String  // 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  
  bucketPath String  // 'users/{userId}/applications/{appId}/resume/resume-v1.pdf'
  fileSize Int       // bytes
  uploadedAt DateTime @default(now())
  uploadedBy String   // userId
  
  @@index([applicationId])
}
```

---

## Full-Text Search Across Documents

**Challenge**: PDFs are binary. Need to extract text before searching.

**Solution**:
1. On upload, extract text from PDF (use `pdfjs` library)
2. Store extracted text in `Document.extractedText` field
3. Index `extractedText` for full-text search
4. Query: `WHERE extractedText ~* 'typescript skills'`

**Performance**: Text extraction happens async after upload (don't block user).

---

## Version History

Multiple resumes allowed per application (e.g., resume-v1.pdf, resume-v2.pdf).

**UI shows**:
- All versions of each document type
- Uploaded date + file size
- Option to download or delete old versions

**No file-level versioning** (just upload new file with new name).

---

## Access Control

**Rules**:
- User can only access their own documents
- Documents deleted if parent application deleted
- Soft-delete (marked `deletedAt`) for recovery

**Query protection**:
```typescript
const doc = await prisma.document.findUnique({
  where: { id: docId },
  include: { application: { include: { user: true } } },
});
if (doc.application.user.id !== currentUserId) {
  throw new ForbiddenError();
}
```

---

## Virus Scanning Integration

**VirusTotal API**:
- Free tier: 4 requests/minute
- Pro tier: Unlimited
- For Phase 12: Use free tier (scan only on upload, not real-time)

**Implementation**:
```typescript
async function scanFile(fileBuffer, fileName) {
  const formData = new FormData();
  formData.append('file', fileBuffer, fileName);
  
  const response = await fetch('https://www.virustotal.com/api/v3/files', {
    method: 'POST',
    headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY },
    body: formData,
  });
  
  const { data } = await response.json();
  return data;  // Contains scan results
}
```

---

## Cleanup Strategy

**Lifecycle**:
1. File uploaded → stored in Supabase
2. Document record created in DB
3. If application deleted → Document marked `deletedAt` (soft delete)
4. After 30 days → Permanent delete from Supabase (run nightly job)

**Nightly cleanup job**:
```typescript
// Every night at 2am
const oldDocuments = await prisma.document.findMany({
  where: {
    deletedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  },
});

for (const doc of oldDocuments) {
  await supabase.storage.from('foray').remove([doc.bucketPath]);
  await prisma.document.delete({ where: { id: doc.id } });
}
```

---

*Phase 12 centralizes document management. No major UX changes — new document browser UI + upload modal.*
