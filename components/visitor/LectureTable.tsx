'use client'

import Link from 'next/link'
import type { LectureVM } from '@/lib/view-model'
import { CountdownOrStatus } from './Countdown'
import { Destination, TypeChip, When } from './cells'
import { EmptyState, type EmptyKind } from './EmptyState'
import { IcsButton } from './IcsButton'

/**
 * جدول الزائر — ثمانية أعمدة موسّطة، منقول من النموذج المعتمد.
 *
 * الترتيب · اللقاء (والكتاب تحته) · الشيخ · الموعد · النوع · الوجهة · العدّاد · زرّ التقويم
 *
 * وفي صفحة السلسلة `/s/[slug]` يسقط عمودا «اللقاء» و«الشيخ» لأنهما ثابتان،
 * فتصير ستة. ولا يسقطان في `/sheikh/[slug]`: القسم ٥ خصّ السلسلة وحدها،
 * والنموذج نفسه لا يُسقطهما عند التصفية بالشيخ.
 *
 * الجدول يختفي دون ٩٦٠ بكسل وتحلّ محلّه البطاقات — بـ`@media` في الورقة
 * لا بقياس عرض في JavaScript، فلا وميض ولا اختلاف بين الخادم والمتصفح.
 */
export function LectureTable({
  rows,
  emptyKind: kind,
  showSeriesColumns = true,
}: {
  rows: LectureVM[]
  emptyKind: EmptyKind
  showSeriesColumns?: boolean
}) {
  // ⚠️ يُحسب قبل فحص الفراغ: النموذج يعود مبكّراً عند الفراغ فتبقى ترويستا
  // العمودين على حالتهما السابقة، ويبقى colspan ثمانية في جدول من ستة أعمدة.
  const colSpan = showSeriesColumns ? 8 : 6

  return (
    // `.noseries` يفعّل شطب عمود «الموعد» للملغى، إذ لا عمود عنوان هنا يحمله
    <div className={showSeriesColumns ? 'tablecard' : 'tablecard noseries'}>
      <table>
        <thead>
          <tr>
            <th className="c-ord">الترتيب</th>
            {showSeriesColumns ? <th id="thLec">اللقاء</th> : null}
            {showSeriesColumns ? <th id="thSh">الشيخ</th> : null}
            <th className="c-when">الموعد</th>
            <th className="c-type">النوع</th>
            <th>الوجهة</th>
            <th className="c-cd">العدّاد</th>
            <th className="c-act" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan}>
                <EmptyState kind={kind} />
              </td>
            </tr>
          ) : (
            rows.map((vm) => (
              <tr key={vm.id} className={vm.rowClass}>
                <td className="ord">{vm.ordAr}</td>

                {showSeriesColumns ? (
                  <td className="title">
                    {/*
                      العنوان داخل <b> عمداً. الورقة فيها
                      `tbody tr.off .title b{text-decoration:line-through}` وهي في
                      النموذج قاعدة ميتة: النموذج يضع <button class="serlink"> مكان
                      الـ<b>، فلا يُشطب اللقاء الملغى في الجدول رغم أن القاعدة ٦.٧
                      تطلبه. تعشيش <b> داخل الرابط يُحييها بلا تعديل حرف في الورقة،
                      وتنسيق `.title b` مطابق لـ`.serlink` فلا فرق بصري في غير الملغى.
                    */}
                    {vm.seriesSlug ? (
                      <Link className="serlink" href={`/s/${vm.seriesSlug}`}>
                        <b>{vm.title}</b>
                      </Link>
                    ) : (
                      <b>{vm.title}</b>
                    )}
                    {vm.book ? <span>{vm.book}</span> : null}
                  </td>
                ) : null}

                {showSeriesColumns ? (
                  <td>
                    <Link className="sheikh" href={`/sheikh/${vm.sheikhSlug}`}>
                      {vm.sheikhName}
                    </Link>
                  </td>
                ) : null}

                <td>
                  <When vm={vm} />
                </td>

                <td>
                  <TypeChip vm={vm} />
                </td>

                <td>
                  {vm.isCancelled ? <span className="state">—</span> : <Destination vm={vm} />}
                </td>

                <td>
                  <CountdownOrStatus vm={vm} />
                </td>

                <td>{vm.status === 'upcoming' ? <IcsButton id={vm.id} /> : null}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
