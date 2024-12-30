import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { format } from 'date-fns';

// Fungsi untuk mendapatkan waktu Jakarta dalam format ISO 8601
const getJakartaTime = () => {
  const jakartaTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
  return new Date(jakartaTime);
};

// GET Route
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bydate = searchParams.get('bydate') === 'true';
    const userid = searchParams.get('userid');
    const type = searchParams.get('type');

    let data;

    if (bydate) {
      const jakartaTime = getJakartaTime();
      const dateOnly = format(jakartaTime, 'yyyy-MM-dd');

      const startDate = `${dateOnly}T00:00:00Z`;
      const endDate = `${dateOnly}T23:59:59Z`;

      data = await prisma.antrian.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          statusAntrian: userid ? 'Progress' : 'Open',
          ...(type && { layanan: type === 'Umum' ? 'Layanan Pelanggan' : 'Layanan Verifikasi' }),
          ...(userid && { assigned: userid }),
        },
      });

      data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else {
      data = await prisma.antrian.findMany();
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching Antrian data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

// PUT Route
export async function PUT(request: Request) {
  try {
    const { antrianID, userID, statusAntrian, operation } = await request.json();

    const jakartaTime = getJakartaTime();
    const updatedAt = format(jakartaTime, 'yyyy-MM-dd HH:mm:ss');

    if (!antrianID || !userID || typeof statusAntrian === 'undefined') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const dateOnly = format(jakartaTime, 'yyyy-MM-dd');
    const startDate = `${dateOnly}T00:00:00Z`;
    const endDate = `${dateOnly}T23:59:59Z`;

    if (operation === 'Ambil') {
      const existingProgressTicket = await prisma.antrian.findFirst({
        where: {
          assigned: userID,
          statusAntrian: 'Progress',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      if (existingProgressTicket) {
        return NextResponse.json(
          { error: 'Tidak bisa mengambil tiket ketika ada tiket yang sedang dikerjakan.' },
          { status: 400 }
        );
      }

      await prisma.antrian.update({
        where: { id: antrianID },
        data: { assigned: userID, statusAntrian, updatedAt },
      });
    } else if (operation === 'Selesai') {
      await prisma.antrian.update({
        where: { id: antrianID },
        data: { assigned: userID, statusAntrian, updatedAt },
      });
    } else {
      return NextResponse.json({ error: 'Invalid operation type' }, { status: 400 });
    }

    return NextResponse.json({ message: 'Antrian updated successfully' });
  } catch (error) {
    console.error('Error updating Antrian:', error);
    return NextResponse.json({ error: 'Failed to update Antrian' }, { status: 500 });
  }
}

// POST Route
export async function POST(request: Request) {
  try {
    const { layanan, kategoriLayanan, statusAntrian } = await request.json();

    const jakartaTime = getJakartaTime();
    const createdAt = format(jakartaTime, 'yyyy-MM-dd HH:mm:ss');
    const dateOnly = format(jakartaTime, 'yyyy-MM-dd');

    const startDate = `${dateOnly}T00:00:00Z`;
    const endDate = `${dateOnly}T23:59:59Z`;

    const countForDate = await prisma.antrian.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        layanan,
      },
    });

    const nomorAntrian = `${countForDate + 1}`;

    const newAntrian = await prisma.antrian.create({
      data: { nomorAntrian, layanan, kategoriLayanan, createdAt, statusAntrian },
    });

    return NextResponse.json(newAntrian.nomorAntrian, { status: 201 });
  } catch (error) {
    console.error('Error creating Antrian:', error);
    return NextResponse.json({ error: 'Failed to create Antrian' }, { status: 500 });
  }
}
