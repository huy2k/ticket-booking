import { PrismaClient, SeatStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu seed dữ liệu...');

  // 1. Dọn dẹp dữ liệu cũ
  await prisma.ticket.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  // 1b. Tạo tài khoản Admin
  const adminHash = await bcrypt.hash('Admin@123', 10);
  await prisma.user.create({
    data: {
      email: 'admin@ticketzone.vn',
      passwordHash: adminHash,
      role: Role.ADMIN,
    },
  });
  console.log('✅ Đã tạo tài khoản Admin: admin@ticketzone.vn / Admin@123');

  // 2. Danh sách Event mẫu
  const eventsData = [
    {
      id: 'demo-event-001',
      name: '🎵 Anh Trai "Say Hi" Concert 2026 - Hà Nội',
      description: 'Đêm nhạc bùng nổ của các Anh Trai với hàng chục siêu hit. Nhanh tay săn vé ngay!',
      saleStartAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // Đã mở bán 2 tiếng trước
      totalSeats: 120, 
    },
    {
      id: 'demo-event-002',
      name: '🎸 Rock Symphony Vol. 5',
      description: 'Sự kết hợp hoàn hảo giữa nhạc Rock nảy lửa và dàn giao hưởng chơi Live.',
      saleStartAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // Đã mở bán 1 ngày trước
      totalSeats: 120,
    },
    {
      id: 'demo-event-003',
      name: '🎤 Indie Music Festival: Mùa Thu',
      description: 'Lễ hội âm nhạc Indie lớn nhất năm quy tụ 20 nghệ sĩ độc lập.',
      saleStartAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // Sắp diễn ra (7 ngày nữa)
      totalSeats: 120,
    },
    {
      id: 'demo-event-004',
      name: '🎹 Đêm nhạc Piano: Giai Điệu Ký Ức',
      description: 'Chìm đắm vào thế giới nhạc thính phòng nhẹ nhàng và sâu lắng.',
      saleStartAt: new Date(Date.now() - 1000 * 60 * 30), // Mới mở bán 30 phút
      totalSeats: 120,
    }
  ];

  // 3. Tạo Sơ đồ ghế cho từng event
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const cols = 12;
  const seatsData: any[] = [];

  for (const evData of eventsData) {
    const event = await prisma.event.create({ data: evData });
    console.log(`✅ Đã tạo event: ${event.name}`);

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      for (let col = 1; col <= cols; col++) {
        let category = 'SILVER';
        let price = 500000;
        
        if (['A', 'B'].includes(row)) {
          category = 'VVIP';
          price = 2500000;
        } else if (['C', 'D', 'E'].includes(row)) {
          category = 'VIP';
          price = 1500000;
        } else if (['F', 'G'].includes(row)) {
          category = 'GOLD';
          price = 800000;
        }

        const isRandomSold = Math.random() < 0.3;

        seatsData.push({
          eventId: event.id,
          seatCode: `${row}${col.toString().padStart(2, '0')}`,
          row: row,
          col: col,
          category: category,
          price: price,
          status: isRandomSold ? SeatStatus.SOLD : SeatStatus.AVAILABLE,
        });
      }
    }
  }

  // Insert multiple seats
  await prisma.seat.createMany({
    data: seatsData,
  });

  console.log(`✅ Đã tạo ${seatsData.length} ghế cho sự kiện (có random Sold).`);
  console.log('✅ Hoàn tất quá trình seed dữ liệu!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
