import ExcelJS from 'exceljs'
import { requireAdmin, fail } from '@/lib/server/admin-guard'
import { supabasePublic } from '@/lib/supabase-public'
import { TYPE_LABEL } from '@/lib/datetime'

/**
 * قالب الاستيراد — يُولَّد وقت الطلب لا ملفاً ثابتاً في `public/`، لأنه
 * يحمل **لائحة المشايخ النشطين الآن** كقائمة تحقّق منسدلة في عمود «رابط
 * الشيخ» — قالب مُنزَّل قبل أسبوع لا يعرف شيخاً أُضيف اليوم.
 *
 * صفّ واحد = لقاء واحد؛ صفوف السلسلة نفسها (رابط واحد) تتكرّر فيها أعمدة
 * العنوان/النوع/المكان... حرفياً، ويختلف فيها التاريخ والوقت — و**رابط
 * الشيخ ومقدار من/إلى** أيضاً، فهذه الثلاثة تخصّ كل لقاء وحده (هجرة ٠٠٣):
 * شيخ اللقاء مطلوب في كل صفّ ولو تكرّر الرابط نفسه (لا شيخ افتراضي واحد
 * للسلسلة بعد اليوم)، والمقدار اختياري وحرّ لكل صفّ. هذا يطابق تماماً ما
 * يتحقّق منه `lib/server/excel-import.ts` عند الرفع.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A3F46' } }
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFCFAF7' } }

const DATA_COLUMNS: { header: string; key: string; width: number }[] = [
  { header: 'رابط السلسلة', key: 'slug', width: 24 },
  { header: 'عنوان اللقاء', key: 'title', width: 30 },
  { header: 'الكتاب (اختياري)', key: 'book', width: 30 },
  { header: 'رابط الشيخ', key: 'sheikhSlug', width: 24 },
  { header: 'مقدار اللقاء — من', key: 'scopeFrom', width: 30 },
  { header: 'مقدار اللقاء — إلى', key: 'scopeTo', width: 30 },
  { header: 'النوع', key: 'type', width: 18 },
  { header: 'المكان (اختياري)', key: 'place', width: 26 },
  { header: 'رابط الخرائط (اختياري)', key: 'mapUrl', width: 30 },
  { header: 'رابط الدخول', key: 'joinUrl', width: 30 },
  { header: 'المدة بالدقيقة', key: 'duration', width: 14 },
  { header: 'تاريخ اللقاء (YYYY-MM-DD)', key: 'date', width: 22 },
  { header: 'وقت اللقاء (HH:MM)', key: 'time', width: 16 },
]

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const { data: sheikhs, error } = await supabasePublic
    .from('sheikhs')
    .select('name, slug')
    .eq('is_active', true)
    .order('name')

  if (error) return fail('تعذّر تجهيز القالب. حاول مرة أخرى.', 503)

  const activeSheikhs = sheikhs ?? []
  const wb = new ExcelJS.Workbook()
  wb.creator = 'منصة اللقاءات العلمية · جمعية سنن'
  wb.created = new Date()

  // ---------- ورقة مرجعية مخفيّة: روابط المشايخ للقائمة المنسدلة ----------
  const wsRef = wb.addWorksheet('قوائم', { state: 'veryHidden' })
  wsRef.getCell('A1').value = 'رابط الشيخ'
  activeSheikhs.forEach((s, i) => {
    wsRef.getCell(`A${i + 2}`).value = s.slug
  })
  const sheikhRefRange = `قوائم!$A$2:$A$${Math.max(activeSheikhs.length + 1, 2)}`
  const typeListFormula = `"${Object.values(TYPE_LABEL).join(',')}"`

  // ---------- ورقة التعليمات ----------
  const wsInfo = wb.addWorksheet('تعليمات', { views: [{ rightToLeft: true }] })
  wsInfo.getColumn(1).width = 90
  const lines = [
    'قالب استيراد سلاسل ولقاءات جديدة — منصة اللقاءات العلمية · جمعية سنن',
    '',
    'كيف تُعبَّأ الورقة الثانية «السلاسل واللقاءات»:',
    '١) كل صفّ يمثّل لقاءً واحداً فقط.',
    '٢) لسلسلة من عدّة لقاءات: كرّر رابط السلسلة نفسه في كل صفوفها، بنفس العنوان والنوع والمكان والروابط والمدة حرفياً — ويختلف التاريخ والوقت من صفّ لآخر دائماً، وقد يختلف الشيخ والمقدار أيضاً (تراوح، أو خطّة شرح يتغيّر موضوعها كل لقاء).',
    '٣) رابط السلسلة يجب أن يكون جديداً تماماً — غير مستخدَم لأي سلسلة موجودة حالياً في المنصة.',
    '٤) عمود «رابط الشيخ» مطلوب في **كل صفّ**، حتى لو تكرّر الرابط نفسه على كل لقاءات السلسلة — لا شيخ افتراضي واحد للسلسلة بعد اليوم. فيه قائمة منسدلة بروابط المشايخ النشطين وقت تنزيل هذا القالب. أضف شيخاً جديداً من تبويب «المشايخ» في اللوحة أولاً إن لم يكن ضمنها.',
    '٥) عمودا «مقدار اللقاء — من/إلى» اختياريان ومستقلّان: ما يغطّيه هذا اللقاء تحديداً من الكتاب (مثلاً «باب الطهارة»). اتركهما فارغين إن لم تحتج تسجيل هذا لسلسلتك.',
    '٦) عمود «النوع» قائمة منسدلة بثلاث قيم فقط: حضوري / عن بُعد / حضوري وعن بُعد.',
    '٧) «رابط الدخول» مطلوب إن كان النوع غير حضوري بحت.',
    '٨) صيغة التاريخ: سنة-شهر-يوم مثل 2026-09-15 — وصيغة الوقت: ساعة:دقيقة على مدار ٢٤ ساعة مثل 20:00.',
    '٩) الملف يُفحَص كاملاً قبل أي حفظ: أي خطأ في أي صفّ يمنع استيراد الملف كله، وتظهر لك قائمة بكل الأخطاء دفعة واحدة لتصحيحها معاً.',
    '',
    `المشايخ النشطون حالياً (${activeSheikhs.length}):`,
  ]
  lines.forEach((text, i) => {
    const cell = wsInfo.getCell(`A${i + 1}`)
    cell.value = text
    if (i === 0) cell.font = { bold: true, size: 13, color: { argb: 'FF2A3F46' } }
  })

  const sheikhTableStart = lines.length + 1
  wsInfo.getCell(`A${sheikhTableStart}`).value = 'الاسم'
  wsInfo.getCell(`B${sheikhTableStart}`).value = 'رابط الشيخ (sheikh_slug)'
  wsInfo.getRow(sheikhTableStart).font = { bold: true }
  wsInfo.getColumn(2).width = 30
  activeSheikhs.forEach((s, i) => {
    wsInfo.getCell(`A${sheikhTableStart + 1 + i}`).value = s.name
    wsInfo.getCell(`B${sheikhTableStart + 1 + i}`).value = s.slug
  })
  if (activeSheikhs.length === 0) {
    wsInfo.getCell(`A${sheikhTableStart + 1}`).value =
      'لا يوجد شيخ نشط بعد — أضف شيخاً من تبويب «المشايخ» قبل الاستيراد.'
  }

  // ---------- ورقة البيانات ----------
  const wsData = wb.addWorksheet('السلاسل واللقاءات', { views: [{ rightToLeft: true }] })
  wsData.columns = DATA_COLUMNS
  wsData.getRow(1).eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
  wsData.getRow(1).height = 34
  wsData.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]

  // صفّ مثال — يُشرح بالمثال لا بالوصف وحده، ويُحذف قبل ملء بيانات حقيقية
  wsData.addRow({
    slug: 'shar-buluq-almaram',
    title: 'شرح بلوغ المرام',
    book: 'بلوغ المرام من أدلة الأحكام',
    sheikhSlug: activeSheikhs[0]?.slug ?? 'abdullah-almohammed',
    scopeFrom: '',
    scopeTo: '',
    type: TYPE_LABEL.onsite,
    place: 'مقر جمعية سنن',
    mapUrl: '',
    joinUrl: '',
    duration: 90,
    date: '2026-09-15',
    time: '20:00',
  })
  wsData.getRow(2).font = { italic: true, color: { argb: 'FF8C847D' } }

  // قوائم التحقّق المنسدلة — ٥٠٠ صفّ يكفي أي فصل دراسي واقعي
  const LAST_ROW = 500
  for (let r = 2; r <= LAST_ROW; r++) {
    wsData.getCell(`D${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [sheikhRefRange],
      showErrorMessage: true,
      errorTitle: 'رابط شيخ غير معروف',
      error: 'اختر رابطاً من القائمة المنسدلة — من المشايخ النشطين وقت تنزيل هذا القالب.',
    }
    wsData.getCell(`G${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [typeListFormula],
      showErrorMessage: true,
      errorTitle: 'نوع غير معروف',
      error: 'اختر إحدى القيم الثلاث من القائمة المنسدلة.',
    }
  }

  const buffer = await wb.xlsx.writeBuffer()

  return new Response(buffer, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': 'attachment; filename="sonan-import-template.xlsx"',
      'cache-control': 'no-store, must-revalidate',
    },
  })
}
