// =============================================================================
// foray — Seed Script
// =============================================================================
// Populates demo data for local development.
// Run: pnpm seed
//
// Idempotent: deletes prior demo data (where userId = 1) before reseeding.
// Safe to run repeatedly.
// =============================================================================

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Copy .env.example to .env and set it.')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const db = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding foray demo data...')

  // -- 1. User -----------------------------------------------------------------
  const user = await db.user.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      email: 'owner@example.com',
      name: 'Foray Owner',
    },
  })
  console.log(`✓ User: ${user.email}`)

  // -- 2. Wipe prior demo records (idempotency) -------------------------------
  await db.event.deleteMany({ where: { userId: user.id } })
  await db.email.deleteMany({ where: { userId: user.id } })
  await db.applicationRecruiter.deleteMany({})
  await db.stage.deleteMany({ where: { application: { userId: user.id } } })
  await db.document.deleteMany({ where: { application: { userId: user.id } } })
  await db.application.deleteMany({ where: { userId: user.id } })
  await db.recruiter.deleteMany({ where: { userId: user.id } })
  await db.company.deleteMany({ where: { userId: user.id } })

  // -- 3. Companies -----------------------------------------------------------
  const stripe = await db.company.create({
    data: {
      userId: user.id,
      name: 'Stripe',
      domain: 'stripe.com',
      website: 'https://stripe.com',
      industry: 'Fintech',
      size: '1k+',
    },
  })
  const linear = await db.company.create({
    data: {
      userId: user.id,
      name: 'Linear',
      domain: 'linear.app',
      website: 'https://linear.app',
      industry: 'SaaS',
      size: '51-200',
    },
  })
  const vercel = await db.company.create({
    data: {
      userId: user.id,
      name: 'Vercel',
      domain: 'vercel.com',
      website: 'https://vercel.com',
      industry: 'Developer tools',
      size: '201-1k',
    },
  })
  const anthropic = await db.company.create({
    data: {
      userId: user.id,
      name: 'Anthropic',
      domain: 'anthropic.com',
      website: 'https://anthropic.com',
      industry: 'AI Research',
      size: '501-1k',
    },
  })
  const localStartup = await db.company.create({
    data: {
      userId: user.id,
      name: 'Saigon Startup',
      domain: 'saigonstartup.vn',
      industry: 'E-commerce',
      size: '11-50',
    },
  })
  console.log(`✓ Companies: 5`)

  // -- 4. Applications across all canonical_status values ---------------------
  const now = new Date()
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400_000)

  const apps = [
    {
      companyId: stripe.id,
      roleTitle: 'Senior Product Manager',
      location: 'Remote (US)',
      salaryMin: 180_000,
      salaryMax: 240_000,
      salaryCurrency: 'USD',
      source: 'linkedin' as const,
      appliedAt: daysAgo(2),
      canonicalStatus: 'applied' as const,
      currentStage: 'Awaiting first response',
      tags: ['dream-job', 'remote'],
    },
    {
      companyId: linear.id,
      roleTitle: 'Product Manager — Growth',
      location: 'Remote',
      source: 'direct' as const,
      appliedAt: daysAgo(7),
      canonicalStatus: 'screening' as const,
      currentStage: 'Recruiter screen scheduled Friday',
      tags: ['remote'],
    },
    {
      companyId: vercel.id,
      roleTitle: 'Technical Product Manager',
      location: 'San Francisco / Remote',
      salaryMin: 200_000,
      salaryMax: 260_000,
      salaryCurrency: 'USD',
      source: 'referral' as const,
      referredBy: 'Phuong Nguyen',
      appliedAt: daysAgo(14),
      canonicalStatus: 'interviewing' as const,
      currentStage: 'On-site round 2 of 3',
      tags: ['referral', 'priority'],
      priority: 1,
    },
    {
      companyId: anthropic.id,
      roleTitle: 'Product Manager, Claude',
      location: 'San Francisco',
      source: 'linkedin' as const,
      appliedAt: daysAgo(21),
      canonicalStatus: 'offer' as const,
      currentStage: 'Offer extended; deadline Friday',
      tags: ['dream-job'],
      priority: 1,
    },
    {
      companyId: localStartup.id,
      roleTitle: 'Senior PM',
      location: 'HCMC',
      salaryMin: 60_000_000,
      salaryMax: 90_000_000,
      salaryCurrency: 'VND',
      source: 'recruiter' as const,
      appliedAt: daysAgo(28),
      canonicalStatus: 'rejected' as const,
      currentStage: 'Closed — culture mismatch per recruiter',
      rejectedAt: daysAgo(20),
      rejectionReason: 'Recruiter said team prefers candidate with more e-commerce-specific experience',
      tags: ['vietnam'],
    },
    {
      companyId: stripe.id,
      roleTitle: 'PM — Issuing',
      location: 'Remote (US)',
      source: 'direct' as const,
      appliedAt: daysAgo(35),
      canonicalStatus: 'withdrawn' as const,
      currentStage: 'Withdrew after Linear became serious',
      tags: ['remote'],
    },
  ]

  let appsCreated = 0
  for (const a of apps) {
    const app = await db.application.create({
      data: {
        userId: user.id,
        ...a,
        lastActivityAt: a.appliedAt,
      },
    })

    await db.event.create({
      data: {
        applicationId: app.id,
        userId: user.id,
        type: 'created',
        source: 'manual',
        occurredAt: a.appliedAt,
      },
    })

    if (a.canonicalStatus !== 'applied') {
      await db.event.create({
        data: {
          applicationId: app.id,
          userId: user.id,
          type: 'status_changed',
          source: 'manual',
          data: { from: 'applied', to: a.canonicalStatus },
          occurredAt: new Date(a.appliedAt.getTime() + 86400_000),
        },
      })
    }

    appsCreated++
  }
  console.log(`✓ Applications: ${appsCreated}`)

  // -- 5. Stages --------------------------------------------------------------
  const vercelApp = await db.application.findFirst({
    where: { userId: user.id, companyId: vercel.id, roleTitle: 'Technical Product Manager' },
  })
  if (vercelApp) {
    await db.stage.createMany({
      data: [
        { applicationId: vercelApp.id, name: 'Recruiter call', order: 1, completedAt: daysAgo(13) },
        { applicationId: vercelApp.id, name: 'Hiring manager screen', order: 2, completedAt: daysAgo(10) },
        { applicationId: vercelApp.id, name: 'On-site round 1: product sense', order: 3, completedAt: daysAgo(5) },
        { applicationId: vercelApp.id, name: 'On-site round 2: execution', order: 4, scheduledAt: new Date(now.getTime() + 2 * 86400_000) },
        { applicationId: vercelApp.id, name: 'On-site round 3: leadership', order: 5 },
      ],
    })
  }
  console.log(`✓ Stages: 5 (Vercel app)`)

  // -- 6. Sample emails (some classified, some in review queue) ---------------
  const stripeApp = await db.application.findFirst({
    where: { userId: user.id, companyId: stripe.id, canonicalStatus: 'applied' },
  })
  if (stripeApp) {
    await db.email.create({
      data: {
        userId: user.id,
        applicationId: stripeApp.id,
        gmailMessageId: 'demo-msg-001',
        gmailThreadId: 'demo-thread-001',
        from: 'careers@stripe.com',
        fromDomain: 'stripe.com',
        subject: 'We received your application',
        bodyExcerpt:
          "Thanks for applying to Senior Product Manager at Stripe. We're reviewing your profile and will be in touch within 2 weeks.",
        receivedAt: daysAgo(2),
        classification: 'noise',
        confidence: 0.88,
        classifiedBy: 'rules',
        reviewedByUser: true,
      },
    })
  }

  // Unmatched email in review queue
  await db.email.create({
    data: {
      userId: user.id,
      gmailMessageId: 'demo-msg-002',
      gmailThreadId: 'demo-thread-002',
      from: 'sarah.chen@brexrecruiting.com',
      fromDomain: 'brexrecruiting.com',
      subject: 'Quick chat about a Senior PM role?',
      bodyExcerpt:
        "Hi! I came across your profile and we have a Senior PM role at a fintech I think you'd be perfect for. Open to a quick call this week?",
      receivedAt: daysAgo(1),
      classification: 'recruiter_outreach',
      confidence: 0.62,
      classifiedBy: 'llm',
      reviewedByUser: false,
    },
  })
  console.log(`✓ Emails: 2 (1 classified, 1 in review queue)`)

  console.log('\n✨ Seed complete.')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
