const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin@123', 10);
  
  const existing = await prisma.user.findFirst({ where: { email: 'admin@ticketzone.vn' } });
  if (existing) {
    // Update role to ADMIN if already exists
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'ADMIN' },
    });
    console.log('✅ Updated existing user to ADMIN:', existing.email);
  } else {
    const admin = await prisma.user.create({
      data: {
        email: 'admin@ticketzone.vn',
        passwordHash,
        role: 'ADMIN',
      },
    });
    console.log('✅ Created admin user:', admin.email);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
