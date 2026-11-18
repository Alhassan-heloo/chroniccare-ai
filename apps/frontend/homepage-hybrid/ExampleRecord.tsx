import type { Language, Text } from './copy';

export type RecordKind = 'pressure' | 'glucose' | 'dose' | 'schedule' | 'visit';

const labels = {
  ar: {
    pressure: 'ضغط الدم', systolic: 'انقباضي', diastolic: 'انبساطي', pressureUnit: 'ملم زئبق',
    measured: 'وقت القياس', at: '٧:٤٥ صباحًا', date: '١٥ نوفمبر', takenAt: '٩:٠٥ صباحًا',
    scheduled: 'الموعد', logged: 'وقت التسجيل', evening: '٩:٠٠ مساءً', pending: 'لم تُسجّل بعد',
    visit: 'سجلّ قبل الزيارة', share: 'مشاركة السجل من «أطبائي»',
  },
  en: {
    pressure: 'Blood pressure', systolic: 'Systolic', diastolic: 'Diastolic', pressureUnit: 'mmHg',
    measured: 'Measured at', at: '7:45 AM', date: '15 November', takenAt: '9:05 AM',
    scheduled: 'Scheduled', logged: 'Logged at', evening: '9:00 PM', pending: 'Not recorded yet',
    visit: 'Record before your visit', share: 'Share your record in My Doctors',
  },
};

export function exampleNumber(value: number, language: Language) {
  return new Intl.NumberFormat(language === 'ar' ? 'ar-u-nu-arab' : 'en').format(value);
}

export default function ExampleRecord({ kind, language, t }: { kind: RecordKind; language: Language; t: Text }) {
  const l = labels[language];
  const number = (value: number) => exampleNumber(value, language);
  const title = { pressure: l.pressure, glucose: t.measurement, dose: t.cardTitles[1], schedule: t.cardTitles[3], visit: l.visit }[kind];
  return <div className="example-record">
    <div className="record-heading"><strong>{title}</strong><span>{t.example}</span></div>
    {kind === 'pressure' && <>
      <div className="record-values">
        <div><span>{l.systolic}</span><strong>{number(124)}</strong></div>
        <div><span>{l.diastolic}</span><strong>{number(79)}</strong></div>
      </div>
      <span className="record-unit">{l.pressureUnit}</span>
    </>}
    {kind === 'glucose' && <div className="record-values"><div><strong>{number(108)}</strong><span>{t.unit}</span></div></div>}
    {(kind === 'pressure' || kind === 'glucose') && <div className="record-row"><span>{l.measured}</span><time dateTime="07:45">{l.at}</time></div>}
    {kind === 'dose' && <>
      <p className="record-state"><span aria-hidden="true">✓</span> {t.dose}</p>
      <div className="record-row"><span>{l.scheduled}</span><time dateTime="09:00">{t.morning}</time></div>
      <div className="record-row"><span>{l.logged}</span><time dateTime="09:05">{l.takenAt}</time></div>
    </>}
    {kind === 'schedule' && <>
      <div className="record-row"><time dateTime="09:00">{t.morning}</time><strong>{t.dose}</strong></div>
      <div className="record-row"><time dateTime="21:00">{l.evening}</time><span>{l.pending}</span></div>
    </>}
    {kind === 'visit' && <>
      <p className="record-date"><time dateTime="2026-11-15">{l.date}</time></p>
      <div className="record-row"><span>{l.pressure}</span><strong><bdi>{number(124)}/{number(79)}</bdi> {l.pressureUnit}</strong></div>
      <div className="record-row"><span>{t.cardTitles[0]}</span><strong>{number(108)} {t.unit}</strong></div>
      <div className="record-row"><span>{t.cardTitles[1]}</span><strong>{t.dose}</strong></div>
      <p className="record-share">{l.share}</p>
    </>}
  </div>;
}

