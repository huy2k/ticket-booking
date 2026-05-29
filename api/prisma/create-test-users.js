const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const users = [
    { email: 'user1@ticketzone.vn', password: 'User1@123' },
    { email: 'user2@ticketzone.vn', password: 'User2@123' },
    { email: 'user3@ticketzone.vn', password: 'User3@123' }
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const existing = await prisma.user.findFirst({ where: { email: u.email } });
    if (existing) {
      console.log(`⚠️ User already exists: ${u.email}`);
    } else {
      const user = await prisma.user.create({
        data: {
          email: u.email,
          passwordHash,
          role: 'USER',
        },
      });
      console.log(`✅ Created test user: ${user.email} / ${u.password}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
