import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale'; // For Indonesian formatting
 
// GET Route
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const bydate = searchParams.get('bydate') === 'true';
    const userid = searchParams.get('userid');
    const type = searchParams.get('type');

    let data;

    if (bydate) {
      // Get Jakarta time and format it for filtering
      const jakartaTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
      const dateOnly = format(new Date(jakartaTime), 'yyyy-MM-dd');

      // Fetch records where createdAt matches today's date
      data = await prisma.antrian.findMany({
        where: {
          createdAt: {
            gte: new Date(`${dateOnly}T00:00:00Z`).toISOString(),
            lte: new Date(`${dateOnly}T23:59:59Z`).toISOString(),
          },
          statusAntrian: userid ? "Progress" : "Open",
          ...(type && { layanan: type === "Umum" ? "Layanan Pelanggan" : "Layanan Verifikasi" }),
          ...(userid && { assigned: userid }),
        },
      });

      data.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else {
      // Fetch all records if bydate is false
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

    const jakartaTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
    const updatedAt = format(new Date(jakartaTime), 'yyyy-MM-dd HH:mm:ss', { locale: localeID });

    if (!antrianID || !userID || typeof statusAntrian === 'undefined') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (operation === 'Ambil') {
      const dateOnly = format(new Date(jakartaTime), 'yyyy-MM-dd');
      const existingProgressTicket = await prisma.antrian.findFirst({
        where: {
          assigned: userID,
          statusAntrian: "Progress",
          createdAt: {
            gte: new Date(`${dateOnly}T00:00:00Z`).toISOString(),
            lte: new Date(`${dateOnly}T23:59:59Z`).toISOString(),
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

    const jakartaTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
    const createdAt = format(new Date(jakartaTime), 'yyyy-MM-dd HH:mm:ss', { locale: localeID });
    const dateOnly = format(new Date(jakartaTime), 'yyyy-MM-dd');

    const countForDate = await prisma.antrian.count({
      where: {
        createdAt: {
          gte: new Date(`${dateOnly}T00:00:00Z`).toISOString(),
          lte: new Date(`${dateOnly}T23:59:59Z`).toISOString(),
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
