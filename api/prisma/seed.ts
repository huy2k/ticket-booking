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
      name: '🎵 Concert Vũ. "Bảo Tàng Của Những Nuối Tiếc"',
      description: 'Tour diễn quảng bá album mới của "Hoàng tử Indie" Việt Nam - Vũ. Đêm nhạc hứa hẹn ngập tràn cảm xúc nhẹ nhàng, hoài niệm.',
      saleStartAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // Mở bán cách đây 2h
      totalSeats: 120,
      location: 'Nhà Thi Đấu Phú Thọ, TP. Hồ Chí Minh',
      eventDate: new Date('2026-07-15T19:30:00Z'),
      bannerUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=600&auto=format&fit=crop',
      category: 'music',
    },
    {
      id: 'demo-event-002',
      name: '🎤 Rap Việt All-Star Concert 2026',
      description: 'Đại nhạc hội Hip-hop quy tụ dàn huấn luyện viên, giám khảo và các thí sinh tài năng nhất Rap Việt. Sân khấu đỉnh cao với âm thanh cực cháy.',
      saleStartAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // Mở bán 1 ngày trước
      totalSeats: 120,
      location: 'Trung tâm Triển lãm SECC, Quận 7, TP. Hồ Chí Minh',
      eventDate: new Date('2026-08-20T20:00:00Z'),
      bannerUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop',
      category: 'music',
    },
    {
      id: 'demo-event-003',
      name: '🎭 Kịch Nói Idecaf: "Ngày Xửa Ngày Xưa 36"',
      description: 'Vở kịch thần thoại vui nhộn, đầy tính nhân văn dành cho gia đình và các em nhỏ, có sự tham gia của các nghệ sĩ gạo cội Idecaf.',
      saleStartAt: new Date(Date.now() - 1000 * 60 * 60 * 3), // Mở bán 3h trước
      totalSeats: 120,
      location: 'Nhà hát Bến Thành, Quận 1, TP. Hồ Chí Minh',
      eventDate: new Date('2026-06-10T18:00:00Z'),
      bannerUrl: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?q=80&w=600&auto=format&fit=crop',
      category: 'theater',
    },
    {
      id: 'demo-event-004',
      name: '🏃 Giải Marathon Quốc Tế TP.HCM Techcombank 2026',
      description: 'Cùng hàng chục nghìn vận động viên chinh phục cung đường qua các địa danh lịch sử của Sài Gòn. Thử thách bản thân với các cự ly 5km, 10km, 21km và 42km.',
      saleStartAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3), // Mở bán sau 3 ngày nữa
      totalSeats: 120,
      location: 'Thảo Cầm Viên, Quận 1, TP. Hồ Chí Minh',
      eventDate: new Date('2026-12-12T04:00:00Z'),
      bannerUrl: 'https://images.unsplash.com/photo-1502224562085-639556652f33?q=80&w=600&auto=format&fit=crop',
      category: 'sports',
    },
    {
      id: 'demo-event-005',
      name: '🎨 Workshop: Vẽ Tranh Acrylic & Trà Chiều',
      description: 'Không gian thư giãn cuối tuần dành cho những ai muốn tự tay vẽ một bức tranh đẹp mang về, nhâm nhi tách trà thơm và kết nối với bạn bè.',
      saleStartAt: new Date(Date.now() - 1000 * 60 * 30), // Mở bán 30 phút trước
      totalSeats: 120,
      location: 'L\'Apothiquaire Spa & Retreat, Quận 3, TP. Hồ Chí Minh',
      eventDate: new Date('2026-06-05T14:00:00Z'),
      bannerUrl: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=600&auto=format&fit=crop',
      category: 'workshop',
    },
    {
      id: 'demo-event-006',
      name: '🎙️ Saigon Tếu - Đêm Hài Độc Thoại Đặc Biệt',
      description: 'Cười thả ga cùng dàn diễn viên hài độc thoại của Saigon Tếu. Những câu chuyện dí dỏm, châm biếm về đời sống đô thị hiện đại.',
      saleStartAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // Mở bán 5h trước
      totalSeats: 120,
      location: 'Hard Rock Cafe, Quận 1, TP. Hồ Chí Minh',
      eventDate: new Date('2026-06-15T20:00:00Z'),
      bannerUrl: 'https://images.unsplash.com/photo-1585699324551-f6c309eed262?q=80&w=600&auto=format&fit=crop',
      category: 'theater',
    },
    {
      id: 'demo-event-007',
      name: '⚡ Sơn Tùng M-TP "Sky Decades" Stadium Tour',
      description: 'Siêu concert kỷ niệm chặng đường âm nhạc của nam ca sĩ hàng đầu Việt Nam - Sơn Tùng M-TP. Sân khấu hoành tráng tiêu chuẩn quốc tế.',
      saleStartAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // Mở bán sau 7 ngày nữa
      totalSeats: 120,
      location: 'Sân vận động Quốc gia Mỹ Đình, Hà Nội',
      eventDate: new Date('2026-09-05T19:00:00Z'),
      bannerUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop',
      category: 'music',
    },
    {
      id: 'demo-event-008',
      name: '🏺 Workshop: Trải Nghiệm Làm Gốm Thủ Công',
      description: 'Lớp học nhập môn làm gốm bằng tay và bàn xoay. Tự tay thiết kế và tạo hình chiếc ly, chiếc đĩa gốm mộc mạc mang dấu ấn cá nhân.',
      saleStartAt: new Date(Date.now() - 1000 * 60 * 60 * 12), // Mở bán 12h trước
      totalSeats: 120,
      location: 'Gốm Chi Studio, Quận 2, TP. Hồ Chí Minh',
      eventDate: new Date('2026-06-20T09:00:00Z'),
      bannerUrl: 'https://images.unsplash.com/photo-1565192647048-f997ded87ab5?q=80&w=600&auto=format&fit=crop',
      category: 'workshop',
    }
  ]

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
