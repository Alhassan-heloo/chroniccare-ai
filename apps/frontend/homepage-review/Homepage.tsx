import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Measurements from './Measurements';
import homePhoto from './at-home.jpg';
import homePhotoSmall from './at-home-small.jpg';

const navigation = [
  { id: 'measurements', label: 'القياسات' },
  { id: 'visit', label: 'قبل زيارة الطبيب' },
] as const;

const shapes = {
  arrow: 'M19 12H5m6-6-6 6 6 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M18 6 6 18',
  moon: 'M20.9 13.4A9 9 0 0 1 10.6 3.1a9 9 0 1 0 10.3 10.3Z',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19m0-14-1.5 1.5m-11 11L5 19m12-7a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
} as const;

function Icon({ name }: { name: keyof typeof shapes }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={shapes[name]} />
  </svg>;
}

function Brand() {
  return <a className="brand" href="#top" dir="ltr" lang="en">
    <svg className="brand-mark" viewBox="0 0 32 32" width="31" height="31" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="currentColor" />
      <path d="M6 17h5l3-7 4 12 3-5h5" stroke="var(--on-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    ChronicCare AI
  </a>;
}

function AccountLink({ children }: { children: ReactNode }) {
  return <a className="primary" href="/register">{children}<Icon name="arrow" /></a>;
}

function Header({ dark, onThemeChange }: { dark: boolean; onThemeChange: () => void }) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);

  return <header className="masthead" onKeyDown={(event) => {
    if (open && event.key === 'Escape') {
      setOpen(false);
      menu.current?.focus();
    }
  }}>
    <div className="wrap masthead-inner">
      <Brand />
      <nav className="wide-nav" aria-label="التنقّل الرئيسي">
        {navigation.map(({ id, label }) => <a href={`#${id}`} key={id}>{label}</a>)}
      </nav>
      <div className="masthead-actions">
        <a className="desktop-login" href="/login">تسجيل الدخول</a>
        <button className="icon-button" type="button" aria-label="الوضع الداكن" aria-pressed={dark} onClick={onThemeChange}>
          <Icon name={dark ? 'sun' : 'moon'} />
        </button>
        <button ref={menu} className="icon-button mobile-toggle" type="button" aria-expanded={open} aria-controls="compact-nav" aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'} onClick={() => setOpen(!open)}>
          <Icon name={open ? 'close' : 'menu'} />
        </button>
      </div>
    </div>
    <nav className="compact-nav" id="compact-nav" hidden={!open} aria-label="التنقّل الرئيسي">
      {navigation.map(({ id, label }) => <a href={`#${id}`} key={id} onClick={() => {
        document.getElementById(id)?.focus({ preventScroll: true });
        setOpen(false);
      }}>{label}</a>)}
      <a href="/login">تسجيل الدخول</a>
    </nav>
  </header>;
}

export default function Homepage() {
  const [dark, setDark] = useState(() => {
    const theme = new URLSearchParams(location.search).get('theme');
    return theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  });

  return <div className="homepage" data-theme={dark ? 'dark' : 'light'} id="top">
    <a className="skip-link" href="#content">انتقل إلى المحتوى</a>
    <Header dark={dark} onThemeChange={() => setDark(value => !value)} />
    <main id="content" tabIndex={-1}>
      <section className="opening wrap" aria-labelledby="opening-title">
        <div className="opening-copy">
          <h1 id="opening-title">سجلّ صحي يرافقك<br />من البيت إلى العيادة.</h1>
          <p>سجّل ضغط الدم والسكر، وتابع مواعيد الدواء، وراجع سجلّك قبل زيارة الطبيب.</p>
          <div className="opening-actions">
            <AccountLink>أنشئ حسابًا</AccountLink>
            <a className="plain-link" href="#measurements">شاهد مثالًا للقياسات</a>
          </div>
        </div>
        <figure className="opening-image">
          <img src={homePhoto} srcSet={`${homePhotoSmall} 840w, ${homePhoto} 1600w`}
            sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1280px) calc(100vw - 88px), 1192px"
            alt="امرأة تساعد رجلًا في وضع كُفّة جهاز قياس الضغط في المنزل"
            width="1600" height="1067" fetchPriority="high" />
        </figure>
      </section>

      <Measurements />

      <section className="visit" id="visit" tabIndex={-1} aria-labelledby="visit-title">
        <div className="wrap visit-grid">
          <div className="visit-copy">
            <h2 id="visit-title">قبل الموعد،<br />راجع سجلّك.</h2>
            <p>افتح تقاريرك لتراجع القياسات خلال الأسبوع، وارجع إلى سجلّ الأدوية لمعرفة الجرعات التي سجّلتها.</p>
            <div className="visit-sharing">
              <h3>مشاركة السجلّ مع طبيبك</h3>
              <ol>
                <li>أدخل رمز الطبيب في «أطبائي».</li>
                <li>راجع هويته ثم وافق على وصوله إلى السجلّ.</li>
              </ol>
              <p>يمكنك إيقاف الوصول في أي وقت.</p>
            </div>
          </div>
          <article className="record" aria-labelledby="record-title">
            <div className="record-heading">
              <h3 id="record-title">ما أراجعه قبل الزيارة</h3>
              <p>مثال توضيحي · ١٥ نوفمبر</p>
            </div>
            <dl className="record-rows">
              <div><dt>ضغط الدم</dt><dd><bdi dir="ltr">١٢٤/٧٩</bdi> ملم زئبق <time dateTime="2026-11-15T08:15">٨:١٥ صباحًا</time></dd></div>
              <div><dt>سكر الدم</dt><dd><bdi>١٠٨</bdi> ملغم/دل <time dateTime="2026-11-15T07:45">٧:٤٥ صباحًا</time></dd></div>
              <div><dt>جرعة الصباح</dt><dd>تم تسجيل تناولها <time dateTime="2026-11-15T09:00">٩:٠٠ صباحًا</time></dd></div>
            </dl>
            <div className="record-access">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" strokeLinecap="round" />
              </svg>
              <p>بعد موافقتك، يستطيع الطبيب المرتبط قراءة السجلّ.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="next-step wrap" aria-labelledby="next-title">
        <h2 id="next-title">ابدأ بأول قراءة.</h2>
        <AccountLink>أنشئ حسابًا</AccountLink>
      </section>
    </main>

    <footer className="footer">
      <div className="footer-inner wrap">
        <Brand />
        <nav aria-label="روابط التذييل">
          <a href="/login">تسجيل الدخول</a>
          <a href="#top">العودة للأعلى</a>
        </nav>
      </div>
    </footer>
  </div>;
}
