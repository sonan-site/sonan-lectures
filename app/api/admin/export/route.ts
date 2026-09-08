import ExcelJS from 'exceljs'
import { requireAdmin, fail } from '@/lib/server/admin-guard'
import { getAdminData } from '@/lib/admin-queries'

/**
 * تصدير كل السلاسل واللقاءات إلى إكسل — تقرير/نسخة احتياطية، لا صيغة
 * لإعادة استيراد آلية. القيم المصدَّرة **فعّالة بعد الوراثة**
 * (`AdminLectureVM.eff*`) لا خاماً، فهي تطابق ما يراه المشرف في الجدول
 * حرفياً — وتشمل المؤرشف والملغى كليهما، خلافاً لِـ`v_lectures` العام.
 *
 * القاعدة ٦.٥: القراءة هنا بمفتاح `anon` عبر `getAdminData()` نفسها التي
 * تغذّي اللوحة — RLS تمنح القراءة للجميع أصلاً، فحارس `requireAdmin()`
 * يحمي **مسار التصدير المُجمَّع** لا سرّية بيانات فردية.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF3EFE9' }, // beige الهوية
}
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FF2A3F46' } } // petrol

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  row.height = 22
}

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  let data: Awaited<ReturnType<typeof getAdminData>>
  try {
    data = await getAdminData()
  } catch {
    return fail('تعذّر جلب البيانات للتصدير. حاول مرة أخرى.', 503)
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'منصة اللقاءات العلمية · جمعية سنن'
  wb.created = new Date()

  // ---------- ورقة السلاسل ----------
  const wsSeries = wb.addWorksheet('السلاسل', { views: [{ rightToLeft: true }] })
  wsSeries.columns = [
    { header: 'رابط السلسلة', key: 'slug', width: 26 },
    { header: 'العنوان', key: 'title', width: 30 },
    { header: 'الكتاب', key: 'book', width: 30 },
    { header: 'الشيخ', key: 'sheikh', width: 22 },
    { header: 'النوع', key: 'type', width: 16 },
    { header: 'عدد اللقاءات', key: 'count', width: 14 },
    { header: 'مؤرشفة', key: 'archived', width: 12 },
  ]
  for (const s of data.series) {
    wsSeries.addRow({
      slug: s.slug,
      title: s.title,
      book: s.book ?? '',
      sheikh: s.sheikhName,
      type: s.typeLabel,
      count: s.count,
      archived: s.isArchived ? 'نعم' : 'لا',
    })
  }
  styleHeaderRow(wsSeries.getRow(1))
  wsSeries.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]

  // ---------- ورقة اللقاءات ----------
  const wsLec = wb.addWorksheet('اللقاءات', { views: [{ rightToLeft: true }] })
  wsLec.columns = [
    { header: 'الترتيب', key: 'ord', width: 10 },
    { header: 'اللقاء', key: 'title', width: 30 },
    { header: 'الكتاب', key: 'book', width: 30 },
    { header: 'الشيخ', key: 'sheikh', width: 22 },
    { header: 'مقدار اللقاء — من', key: 'scopeFrom', width: 30 },
    { header: 'مقدار اللقاء — إلى', key: 'scopeTo', width: 30 },
    { header: 'التاريخ', key: 'date', width: 13 },
    { header: 'الوقت', key: 'time', width: 10 },
    { header: 'اليوم', key: 'weekday', width: 12 },
    { header: 'التاريخ الهجري', key: 'hijri', width: 24 },
    { header: 'المدة (دقيقة)', key: 'duration', width: 14 },
    { header: 'النوع', key: 'type', width: 16 },
    { header: 'الحالة', key: 'status', width: 14 },
    { header: 'ملغى', key: 'cancelled', width: 10 },
    { header: 'مؤرشف', key: 'archived', width: 10 },
    { header: 'مختلف عن السلسلة', key: 'overridden', width: 18 },
  ]
  for (const l of data.lectures) {
    wsLec.addRow({
      ord: l.ordAr,
      title: l.seriesTitle,
      book: l.seriesBook ?? '',
      sheikh: l.sheikhName,
      scopeFrom: l.scopeFrom ?? '',
      scopeTo: l.scopeTo ?? '',
      date: l.dateInput,
      time: l.timeInput,
      weekday: l.weekdayName,
      hijri: l.hijri,
      duration: l.effDuration,
      type: l.effTypeLabel,
      status: l.statusLabel,
      cancelled: l.isCancelled ? 'نعم' : 'لا',
      archived: l.isArchived || l.seriesArchived ? 'نعم' : 'لا',
      overridden: l.isOverridden ? 'نعم' : 'لا',
    })
  }
  styleHeaderRow(wsLec.getRow(1))
  wsLec.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]

  const buffer = await wb.xlsx.writeBuffer()
  const stamp = new Date().toISOString().slice(0, 10)

  return new Response(buffer, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="sonan-export-${stamp}.xlsx"`,
      'cache-control': 'no-store, must-revalidate',
    },
  })
}
