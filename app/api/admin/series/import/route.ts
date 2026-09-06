import ExcelJS from 'exceljs'
import { NextResponse } from 'next/server'
import { fail, requireAdmin, sameOrigin } from '@/lib/server/admin-guard'
import { supabaseAdmin } from '@/lib/server/supabase-admin'
import { parseImportRows, type ImportRow, type RowIssue } from '@/lib/server/excel-import'

/**
 * استيراد سلاسل ولقاءات جديدة بالجملة من ملف إكسل مبنيّ على القالب
 * (`app/api/admin/series/import-template/route.ts`).
 *
 * **لا يُحدَّث ولا يُدمَج شيء قائم** — كل صفّ ينتمي إما لسلسلة جديدة
 * تُنشَأ، أو يُرفض الملف كله إن طابق رابطه سلسلة موجودة (قرار صاحب
 * المشروع، لا استثناء).
 *
 * ⚠️ **ترتيب الأعمدة أدناه (`col`) يجب أن يطابق `DATA_COLUMNS` في
 * `import-template/route.ts` حرفياً** — القراءة هنا بترقيم الأعمدة لا
 * بأسمائها، لأن Excel لا يحفظ مفاتيح exceljs الداخلية عبر حفظ وإعادة فتح.
 *
 * المرحلتان: (١) تحقّق الملف كاملاً بلا أي كتابة — `parseImportRows` ثم
 * فحصا قاعدة بيانات دفعيّان (الروابط غير مكرَّرة، المشايخ موجودون
 * ونشطون)؛ أي خطأ في أي مكان ⇐ لا يُكتَب شيء. (٢) بعد نجاح الملف كاملاً:
 * إدخال كل مجموعة سلسلة بنمط `app/api/admin/series/route.ts` تماماً —
 * لقطة الشيخ، ثم اللقاءات مرتَّبة بالتاريخ، وحذف تعويضي للسلسلة إن فشل
 * إدخال لقاءاتها.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MAX_XLSX_BYTES = 4 * 1024 * 1024
const MAX_TOTAL_ROWS = 2000
const MAX_SERIES_PER_FILE = 200
const DATA_SHEET_NAME = 'السلاسل واللقاءات'

/** يطابق ترتيب DATA_COLUMNS في import-template/route.ts — بالترقيم لا بالاسم */
const col = {
  slug: 1,
  title: 2,
  book: 3,
  sheikhSlug: 4,
  type: 5,
  place: 6,
  mapUrl: 7,
  joinUrl: 8,
  duration: 9,
  date: 10,
  time: 11,
} as const

function cellRaw(cell: ExcelJS.Cell): unknown {
  const v = cell.value
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'object') {
    const o = v as unknown as Record<string, unknown>
    if (Array.isArray(o.richText)) {
      return (o.richText as { text: string }[]).map((r) => r.text).join('')
    }
    if (typeof o.result !== 'undefined') return o.result
    if (typeof o.text !== 'undefined') return o.text
  }
  return v
}

/** تاريخ Excel يعود كائن Date — يُحوَّل لصيغة نصّية يفهمها riyadhToInstant */
function dateCellToText(v: unknown): unknown {
  return v instanceof Date ? v.toISOString().slice(0, 10) : v
}

function timeCellToText(v: unknown): unknown {
  return v instanceof Date ? v.toISOString().slice(11, 16) : v
}

function rowIsBlank(row: ExcelJS.Row): boolean {
  return !cellRaw(row.getCell(col.slug)) && !cellRaw(row.getCell(col.title))
}

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied
  if (!sameOrigin(request)) return fail('طلب من مصدر غير موثوق.', 403)

  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_XLSX_BYTES + 8192) {
    return fail('حجم الملف يتجاوز ٤ ميجابايت.', 413)
  }

  let file: File
  try {
    const form = await request.formData()
    const value = form.get('file')
    if (!(value instanceof File)) return fail('لم يصل أي ملف.', 400)
    file = value
  } catch {
    return fail('تعذّر قراءة الملف المُرسَل.', 400)
  }

  if (file.size === 0) return fail('الملف فارغ.', 400)
  if (file.size > MAX_XLSX_BYTES) return fail('حجم الملف يتجاوز ٤ ميجابايت.', 413)

  const bytes = await file.arrayBuffer()

  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(bytes)
  } catch {
    return fail('تعذّر قراءة الملف. تأكّد أنه ملف إكسل (.xlsx) صحيح ولم يتلف.', 415)
  }

  const sheet = wb.getWorksheet(DATA_SHEET_NAME) ?? wb.worksheets.at(-1)
  if (!sheet) {
    return fail('لم يُعثر على ورقة بيانات في الملف.', 422)
  }

  if (sheet.rowCount - 1 > MAX_TOTAL_ROWS) {
    return fail(`عدد صفوف اللقاءات أكثر من ${MAX_TOTAL_ROWS} — قسّم الملف على دفعات.`, 422)
  }

  // ---------- بناء صفوف مجرَّدة من ورقة إكسل ----------
  const rows: ImportRow[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // الرأس
    if (rowIsBlank(row)) return
    rows.push({
      row: rowNumber,
      seriesSlug: cellRaw(row.getCell(col.slug)),
      title: cellRaw(row.getCell(col.title)),
      book: cellRaw(row.getCell(col.book)),
      sheikhSlug: cellRaw(row.getCell(col.sheikhSlug)),
      typeLabel: cellRaw(row.getCell(col.type)),
      place: cellRaw(row.getCell(col.place)),
      mapUrl: cellRaw(row.getCell(col.mapUrl)),
      joinUrl: cellRaw(row.getCell(col.joinUrl)),
      duration: cellRaw(row.getCell(col.duration)),
      date: dateCellToText(cellRaw(row.getCell(col.date))),
      time: timeCellToText(cellRaw(row.getCell(col.time))),
    })
  })

  if (rows.length === 0) {
    return fail(
      'الملف لا يحتوي على أي صفّ بيانات. تأكّد أنك عبّأت ورقة «السلاسل واللقاءات» تحت رأسها مباشرة.',
      422
    )
  }

  // ---------- المرحلة ١: تحقّق خالص بلا أي كتابة ----------
  const { groups, issues } = parseImportRows(rows)

  if (groups.length > MAX_SERIES_PER_FILE) {
    return fail(`عدد السلاسل في الملف أكثر من ${MAX_SERIES_PER_FILE} — قسّم الملف على دفعات.`, 422)
  }

  if (issues.length === 0 && groups.length === 0) {
    return fail('لم يُستخرَج أي سلسلة صالحة من الملف.', 422)
  }

  // ---------- فحصان دفعيّان على قاعدة البيانات — لا كتابة بعد ----------
  //
  // ⚠️ يعملان دائماً، حتى لو حمل الملف أخطاءً أخرى مسبقاً من parseImportRows:
  // الهدف جمع **كل** أخطاء الملف دفعة واحدة، لا التوقّف عند أول نوع خطأ.
  // لو تأخّر هذان الفحصان خلف `if (issues.length === 0)` لَغاب مثلاً خطأ
  // "شيخ غير موجود" في سلسلة سليمة الشكل، لمجرَّد أن سلسلة أخرى في الملف
  // نفسه بها خطأ تنسيق بسيط — فيُصلِح المشرف نصف الأخطاء ليكتشف البقية
  // في محاولة رفعٍ ثانية، وهذا ما تحديداً صُمِّم هذا المسار ليتجنَّبه.
  const sheikhBySlug = new Map<
    string,
    { id: string; name: string; slug: string; is_active: boolean }
  >()

  if (groups.length > 0) {
    const slugs = groups.map((g) => g.slug)
    const { data: existingSeries, error: seriesLookupErr } = await supabaseAdmin
      .from('series')
      .select('slug')
      .in('slug', slugs)

    if (seriesLookupErr) return fail('تعذّر التحقّق من روابط السلاسل. حاول مرة أخرى.', 503)

    const taken = new Set((existingSeries ?? []).map((s) => s.slug as string))
    for (const g of groups) {
      if (taken.has(g.slug)) {
        issues.push({
          row: g.firstRow,
          message: `رابط السلسلة «${g.slug}» مستخدم بالفعل لسلسلة موجودة — رُفض الملف كاملاً، لم يُنشأ شيء منه. غيّر الرابط في الملف أو احذف صفوف هذه السلسلة.`,
        })
      }
    }

    const sheikhSlugs = [...new Set(groups.map((g) => g.sheikhSlug))]
    const { data: sheikhRows, error: sheikhLookupErr } = await supabaseAdmin
      .from('sheikhs')
      .select('id, name, slug, is_active')
      .in('slug', sheikhSlugs)

    if (sheikhLookupErr) return fail('تعذّر التحقّق من المشايخ. حاول مرة أخرى.', 503)

    for (const s of sheikhRows ?? []) {
      sheikhBySlug.set(s.slug as string, s as { id: string; name: string; slug: string; is_active: boolean })
    }

    for (const g of groups) {
      const sh = sheikhBySlug.get(g.sheikhSlug)
      if (!sh) {
        issues.push({ row: g.firstRow, message: `الشيخ برابط «${g.sheikhSlug}» غير موجود.` })
      } else if (!sh.is_active) {
        issues.push({
          row: g.firstRow,
          message: `الشيخ «${sh.name}» (${g.sheikhSlug}) غير نشط، فلا تُنشأ له سلسلة جديدة.`,
        })
      }
    }
  }

  if (issues.length > 0) {
    const sorted: RowIssue[] = issues.slice().sort((a, b) => a.row - b.row)
    return NextResponse.json(
      { error: `الملف يحتوي على ${sorted.length} خطأً — لم يُنشأ شيء منه بعد.`, issues: sorted },
      { status: 422 }
    )
  }

  // ---------- المرحلة ٢: الكتابة الفعلية، مجموعة فمجموعة ----------
  const created: { slug: string; title: string; count: number }[] = []
  const failed: { slug: string; message: string }[] = []

  for (const g of groups) {
    const sh = sheikhBySlug.get(g.sheikhSlug)!

    const { data: newSeries, error: seriesErr } = await supabaseAdmin
      .from('series')
      .insert({
        title: g.title,
        slug: g.slug,
        book: g.book,
        sheikh_id: sh.id,
        sheikh_name: sh.name,
        sheikh_slug: sh.slug,
        type: g.type,
        place: g.place,
        map_url: g.mapUrl,
        join_url: g.joinUrl,
        duration_min: g.durationMin,
      })
      .select('id')
      .single()

    if (seriesErr || !newSeries) {
      failed.push({ slug: g.slug, message: 'تعذّر إنشاء هذه السلسلة. حاول استيرادها وحدها مرة أخرى.' })
      continue
    }

    const lectureRows = g.lectures.map((l, i) => ({
      series_id: newSeries.id,
      ord: i + 1,
      starts_at: l.startsAt,
    }))

    const { error: lecErr } = await supabaseAdmin.from('lectures').insert(lectureRows)

    if (lecErr) {
      await supabaseAdmin.from('series').delete().eq('id', newSeries.id)
      failed.push({ slug: g.slug, message: 'تعذّر إنشاء لقاءاتها، فأُلغي إنشاؤها. حاول استيرادها وحدها مرة أخرى.' })
      continue
    }

    created.push({ slug: g.slug, title: g.title, count: lectureRows.length })
  }

  return NextResponse.json({
    ok: true,
    created,
    failed,
    totalSeries: created.length,
    totalLectures: created.reduce((n, c) => n + c.count, 0),
  })
}
