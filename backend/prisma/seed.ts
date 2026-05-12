import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding IDES database with multi-day summit agenda...');

  // Clear existing data
  await prisma.notification.deleteMany();
  await prisma.questionUpvote.deleteMany();
  await prisma.question.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.voiceNote.deleteMany();
  await prisma.content.deleteMany();
  await prisma.sessionSpeaker.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  console.log('🗑️  Cleared existing data');

  // Create password
  const commonPassword = await bcrypt.hash('speaker123', 12);
  const adminPassword = await bcrypt.hash('admin123', 12);
  const modPassword = await bcrypt.hash('moderator123', 12);

  // Users
  const admin = await prisma.user.create({
    data: { email: 'admin@summit.org', password: adminPassword, name: 'Summit Admin', role: 'ADMIN' },
  });

  const moderator = await prisma.user.create({
    data: { email: 'moderator@summit.org', password: modPassword, name: 'Session Moderator', role: 'MODERATOR' },
  });

  // Speakers
  const thilaka = await prisma.user.create({
    data: { email: 'thilaka@moie.gov.lk', password: commonPassword, name: 'Ms. Thilaka Jayasundara', role: 'SPEAKER' },
  });
  const ranjan = await prisma.user.create({
    data: { email: 'ranjan@capceylon.com', password: commonPassword, name: 'Mr. Ranjan T. Hanchapola', role: 'SPEAKER' },
  });
  const chathuranga = await prisma.user.create({
    data: { email: 'chathuranga@moie.gov.lk', password: commonPassword, name: 'Hon. Chathuranga Abeysinghe', role: 'SPEAKER' },
  });
  const amila = await prisma.user.create({
    data: { email: 'amila@worldbank.org', password: commonPassword, name: 'Ms. Amila Dahanayake', role: 'SPEAKER' },
  });
  const anoja = await prisma.user.create({
    data: { email: 'anoja@moie.gov.lk', password: commonPassword, name: 'Ms. Anoja Herath', role: 'SPEAKER' },
  });
  const yasas = await prisma.user.create({
    data: { email: 'yasas@moie.gov.lk', password: commonPassword, name: 'Mr. Yasas Hewage', role: 'SPEAKER' },
  });
  const zoe = await prisma.user.create({
    data: { email: 'zoe@austhc.gov.au', password: commonPassword, name: 'Ms. Zoe Kidd', role: 'SPEAKER' },
  });
  const sunil = await prisma.user.create({
    data: { email: 'sunil@moie.gov.lk', password: commonPassword, name: 'Hon. Sunil Hadunnetthi', role: 'SPEAKER' },
  });
  const speakerITIA = await prisma.user.create({
    data: { email: 'itia@summit.org', password: commonPassword, name: 'ITIA Director', role: 'SPEAKER' },
  });

  // ============================================================
  // DAY 1 — May 13th, 2026
  // ============================================================
  console.log('📅 Seeding Day 1...');

  const day1Sessions = [
    {
      title: 'National Anthem',
      startTime: '2026-05-13T14:00:00+05:30',
      endTime: '2026-05-13T14:10:00+05:30',
      track: 'Ceremony',
      order: 1,
    },
    {
      title: 'Welcome and Opening Remarks',
      description: 'MOIE Journey, vision, policy direction and invitation to Partners',
      startTime: '2026-05-13T14:10:00+05:30',
      endTime: '2026-05-13T14:20:00+05:30',
      track: 'Opening',
      order: 2,
      speakers: [thilaka.id],
    },
    {
      title: 'From Local Roots to Global Markets: Navigating Ecosystem Challenges',
      description: 'Building an Organic Export Brand',
      startTime: '2026-05-13T14:20:00+05:30',
      endTime: '2026-05-13T14:30:00+05:30',
      track: 'Entrepreneurship',
      order: 3,
      speakers: [ranjan.id],
    },
    {
      title: 'Shift from Development to Transformation',
      startTime: '2026-05-13T14:30:00+05:30',
      endTime: '2026-05-13T14:45:00+05:30',
      track: 'Keynote',
      order: 4,
      speakers: [chathuranga.id],
    },
    {
      title: 'Ecosystem Gaps and Best Strategies for Transformation',
      description: 'Perspective of The World Bank with Research Findings',
      startTime: '2026-05-13T14:45:00+05:30',
      endTime: '2026-05-13T15:00:00+05:30',
      track: 'Research',
      order: 5,
      speakers: [amila.id],
    },
    {
      title: 'National SME Development Strategy Framework',
      startTime: '2026-05-13T15:00:00+05:30',
      endTime: '2026-05-13T15:15:00+05:30',
      track: 'Strategy',
      order: 6,
      speakers: [anoja.id, yasas.id],
    },
    {
      title: 'Launch – National SME Strategy Framework',
      startTime: '2026-05-13T15:15:00+05:30',
      endTime: '2026-05-13T15:25:00+05:30',
      track: 'Launch',
      order: 7,
    },
    {
      title: 'Recognition of Implementation Partners of SME Strategy',
      description: 'Pillar 02 – ADB | Pillar 08 – SLIM / DEFAT | Pillar 11 – DEFAT/ILO/Chrysalis',
      startTime: '2026-05-13T15:25:00+05:30',
      endTime: '2026-05-13T15:35:00+05:30',
      track: 'Partners',
      order: 8,
    },
    {
      title: 'Australia and Sri Lanka Building Skills for the Future',
      startTime: '2026-05-13T15:35:00+05:30',
      endTime: '2026-05-13T15:45:00+05:30',
      track: 'Skills',
      order: 9,
    },
    {
      title: 'Enhancing Skills for Global Competitiveness',
      startTime: '2026-05-13T15:45:00+05:30',
      endTime: '2026-05-13T16:00:00+05:30',
      track: 'Skills',
      order: 10,
      speakers: [zoe.id],
    },
    {
      title: 'Shift the Gear Towards and Entrepreneurial Journey',
      startTime: '2026-05-13T16:00:00+05:30',
      endTime: '2026-05-13T16:15:00+05:30',
      track: 'Keynote',
      order: 11,
      speakers: [sunil.id],
    },
    {
      title: 'Wrap Up and Networking',
      startTime: '2026-05-13T16:15:00+05:30',
      endTime: '2026-05-13T16:30:00+05:30',
      track: 'Closing',
      order: 12,
    },
  ];

  for (const s of day1Sessions) {
    const session = await prisma.session.create({
      data: {
        title: s.title,
        description: s.description || '',
        startTime: new Date(s.startTime),
        endTime: new Date(s.endTime),
        track: s.track,
        day: 1,
        order: s.order,
        location: 'The Grand Maitland, Colombo 07',
        isActive: false,
      }
    });

    if (s.speakers) {
      for (const speakerId of s.speakers) {
        await prisma.sessionSpeaker.create({
          data: { sessionId: session.id, speakerId }
        });
      }
    }
  }

  // ============================================================
  // DAY 2 — May 14th, 2026
  // ============================================================
  console.log('📅 Seeding Day 2...');

  const day2Sessions = [
    { title: 'Registration & Refreshments', start: '08:30', end: '09:00', track: 'Pre-Session', order: 1 },
    { title: 'Welcome Address', start: '09:00', end: '09:10', track: 'Pre-Session', order: 2, speakers: [anoja.id] },
    { title: 'Transition from Policy Launch to Delivery', start: '09:10', end: '09:20', track: 'Pre-Session', order: 3, speakers: [yasas.id] },
    { title: 'ITIA Transformation – Operating Model', start: '09:20', end: '10:00', track: 'Pre-Session', order: 4, speakers: [speakerITIA.id], active: true },
    { title: 'Session 1 – New Business Creation', start: '10:00', end: '11:00', track: 'Core Track', order: 5 },
    { title: 'Tea Break', start: '11:00', end: '11:15', track: 'Break', order: 6 },
    { title: 'Session 2 – Skills Development', start: '11:15', end: '12:15', track: 'Core Track', order: 7 },
    { title: 'Session 3 – Access to Finance', start: '12:15', end: '13:15', track: 'Core Track', order: 8 },
    { title: 'Lunch Break', start: '13:15', end: '14:15', track: 'Break', order: 9 },
    { title: 'Session 4 – Global Value Chain Integration', start: '14:15', end: '15:15', track: 'Core Track', order: 10 },
    { title: 'Systems, Governance & Accountability', start: '15:15', end: '16:00', track: 'Governance', order: 11 },
    { title: 'Tea Break', start: '16:00', end: '16:15', track: 'Break', order: 12 },
    { title: 'High Level Panel – Political Vision', start: '16:15', end: '17:00', track: 'High Level', order: 13 },
    { title: 'Closing Remarks & Networking', start: '17:00', end: '17:15', track: 'Closing', order: 14 },
  ];

  for (const s of day2Sessions) {
    const session = await prisma.session.create({
      data: {
        title: s.title,
        startTime: new Date(`2026-05-14T${s.start}:00+05:30`),
        endTime: new Date(`2026-05-14T${s.end}:00+05:30`),
        track: s.track,
        day: 2,
        order: s.order,
        location: 'Main Hall, The Grand Maitland',
        isActive: s.active || false,
      }
    });

    if (s.speakers) {
      for (const speakerId of s.speakers) {
        await prisma.sessionSpeaker.create({
          data: { sessionId: session.id, speakerId }
        });
      }
    }
  }

  console.log('✅ Seed complete! Multi-day agenda ready.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
