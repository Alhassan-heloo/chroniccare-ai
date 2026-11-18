import { useRef, useState } from 'react';
import {
  Activity, ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ClipboardList, Droplet,
  HeartPulse, Menu, Moon, Pill, Sun, X,
} from 'lucide-react';
import portrait from './portrait.jpg';
import portraitMobile from './portrait-mobile.jpg';
import consultation from './consultation.jpg';
import './preview.css';

const links = [
  { href: '#readings', label: 'القياسات', icon: Droplet },
  { href: '#routine', label: 'روتين المتابعة', icon: Pill },
  { href: '#doctor', label: 'زيارة الطبيب', icon: ClipboardList },
];

const routines = [
  { when: 'عند القياس', title: 'سجّل ضغط الدم والسكر', copy: 'أضف القراءة ووقت القياس، واكتب ملاحظة إذا أردت تذكّر شيء عنها.' },
  { when: 'عند موعد الدواء', title: 'تابع جرعاتك', copy: 'راجع جدول الدواء وسجّل حالة الجرعة لتعود إليها لاحقًا.' },
  { when: 'قبل الموعد الطبي', title: 'راجع سجلّك', copy: 'ارجع إلى القراءات والجرعات المسجّلة خلال الفترة التي تريد مناقشتها مع طبيبك.' },
];

const example = {
  pressure: {
    name: 'ضغط الدم',
    value: '124/79',
    unit: 'ملم زئبق',
    domain: [65, 145],
    ticks: [140, 110, 80],
    series: [
      { name: 'الانقباضي', values: [129, 122, 131, 126, 120, 123, 124], kind: 'primary' },
      { name: 'الانبساطي', values: [81, 76, 84, 78, 75, 77, 79], kind: 'secondary' },
    ],
  },
  glucose: {
    name: 'سكر الدم',
    value: '108',
    unit: 'ملغم/دل',
    domain: [70, 155],
    ticks: [150, 115, 80],
    series: [
      { name: 'قبل الإفطار', values: [115, 128, 119, 113, 123, 111, 108], kind: 'primary' },
    ],
  },
} as const;

type Reading = keyof typeof example;
const readings = ['pressure', 'glucose'] as const;
const days = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

function Brand() {
  return <a className="brand" href="#top" aria-label="ChronicCare AI، إلى بداية الصفحة">
    <span className="brand-icon"><Activity size={18} aria-hidden="true" /></span>
    <span dir="ltr" lang="en">ChronicCare <b>AI</b></span>
  </a>;
}

function JoinLink({ inverse = false }: { inverse?: boolean }) {
  return <a className={inverse ? 'button button--light' : 'button button--solid'} href="/register">
    أنشئ حسابًا <ArrowLeft size={18} aria-hidden="true" />
  </a>;
}

function Header({ theme, toggleTheme }: { theme: 'light' | 'dark'; toggleTheme: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const menuToggle = useRef<HTMLButtonElement>(null);

  return <header className="header" onKeyDown={(event) => {
    if (event.key === 'Escape' && expanded) {
      setExpanded(false);
      menuToggle.current?.focus();
    }
  }}>
    <div className="frame header-inner">
      <Brand />
      <nav className="desktop-nav" aria-label="التنقّل الرئيسي">
        {links.map(({ href, label }) => <a key={href} href={href}>{label}</a>)}
      </nav>
      <div className="header-actions">
        <button className="icon-button" type="button" aria-label="الوضع الداكن" aria-pressed={theme === 'dark'} onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
        </button>
        <a href="/login" className="login-link">تسجيل الدخول</a>
        <JoinLink />
        <button ref={menuToggle} className="icon-button menu-toggle" type="button" aria-label={expanded ? 'إغلاق القائمة' : 'فتح القائمة'} aria-controls="mobile-nav" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
    </div>
    <nav id="mobile-nav" className="mobile-nav" aria-label="التنقّل الرئيسي" hidden={!expanded}>
      {links.map(({ href, label }) => <a key={href} href={href} onClick={(event) => {
        document.getElementById(href.slice(1))?.focus();
        if (window.location.hash === href) event.preventDefault();
        setExpanded(false);
      }}>{label}<ArrowLeft size={16} aria-hidden="true" /></a>)}
      <a href="/login">تسجيل الدخول<ArrowLeft size={16} aria-hidden="true" /></a>
    </nav>
  </header>;
}

function ReadingChart({ reading }: { reading: Reading }) {
  const item = example[reading];
  const plotWidth = 560;
  const plotHeight = 144;
  const x = (index: number) => 9 + index * (plotWidth - 18) / (days.length - 1);
  const y = (value: number) => 8 + (item.domain[1] - value) / (item.domain[1] - item.domain[0]) * (plotHeight - 18);

  return <figure className="chart" aria-label="اتجاه القراءات خلال سبعة أيام">
    <div className="chart-area" aria-hidden="true" dir="ltr">
      <svg viewBox={`0 0 ${plotWidth} ${plotHeight}`} preserveAspectRatio="none" focusable="false">
        <defs>
          <linearGradient id="reading-wash" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor="var(--chart-line)" stopOpacity=".24" />
            <stop offset="100%" stopColor="var(--chart-line)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {item.ticks.map((tick) => <line className="chart-grid" key={tick} x1="0" x2={plotWidth} y1={y(tick)} y2={y(tick)} />)}
        <polygon points={`${x(0)},${plotHeight} ${item.series[0].values.map((value, index) => `${x(index)},${y(value)}`).join(' ')} ${x(days.length - 1)},${plotHeight}`} fill="url(#reading-wash)" />
        {item.series.map(({ name, values, kind }) => <g className={`chart-series chart-series--${kind}`} key={name}>
          <polyline points={values.map((value, index) => `${x(index)},${y(value)}`).join(' ')} />
          {values.map((value, index) => <circle key={days[index]} cx={x(index)} cy={y(value)} r={index === values.length - 1 ? 5 : 3} />)}
        </g>)}
      </svg>
      {item.ticks.map((tick) => <span className="chart-tick" key={tick} style={{ top: `${y(tick) / plotHeight * 100}%` }}>{tick}</span>)}
    </div>
    <div className="chart-days" dir="ltr" aria-hidden="true"><span>السبت</span><span>الثلاثاء</span><span>الجمعة</span></div>
    <figcaption className="legend">
      {item.series.map(({ name, kind }) => <span key={name}><i className={`legend-dot legend-dot--${kind}`} aria-hidden="true" />{name}</span>)}
    </figcaption>
    <table className="sr-only">
      <caption>{item.name} خلال سبعة أيام، {item.unit}</caption>
      <thead><tr><th scope="col">اليوم</th>{item.series.map(({ name }) => <th scope="col" key={name}>{name}</th>)}</tr></thead>
      <tbody>{days.map((day, index) => <tr key={day}><th scope="row">{day}</th>{item.series.map(({ name, values }) => <td key={name}>{values[index]}</td>)}</tr>)}</tbody>
    </table>
  </figure>;
}

function Readings() {
  const [reading, setReading] = useState<Reading>('pressure');
  const item = example[reading];
  return <section className="readings section" id="readings" tabIndex={-1} aria-labelledby="readings-title">
    <div className="frame readings-layout">
      <div className="section-copy">
        <p className="kicker"><HeartPulse size={20} aria-hidden="true" /> سجلّ القياسات</p>
        <h2 id="readings-title">قراءاتك على مدار الأسبوع.</h2>
        <p>سجّل ضغط الدم والسكر، ثم ارجع إلى القراءات السابقة وقارنها من يوم لآخر.</p>
      </div>
      <div className="reading-sample">
        <div className="sample-heading"><span>سجلّ أسبوع واحد</span><span>بيانات افتراضية</span></div>
        <fieldset className="segment">
          <legend className="sr-only">اختر نوع القياس</legend>
          {readings.map((key) => <label key={key}>
            <input className="sr-only" type="radio" name="sample-reading" value={key} checked={reading === key} onChange={() => setReading(key)} />
            <span>{example[key].name}</span>
          </label>)}
        </fieldset>
        <p className="reading-value" aria-live="polite"><span className="sr-only">آخر قراءة {item.name}: </span><bdi>{item.value}</bdi><span>{item.unit}</span></p>
        <ReadingChart reading={reading} />
      </div>
    </div>
  </section>;
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const requested = new URLSearchParams(location.search).get('theme');
    if (requested === 'dark' || requested === 'light') return requested;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  return <div className="preview" data-theme={theme} id="top">
    <a className="skip" href="#main">انتقل إلى المحتوى</a>
    <Header theme={theme} toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
    <main id="main" tabIndex={-1}>
      <section className="hero" aria-labelledby="hero-title">
        <picture className="hero-picture">
          <source media="(max-width: 650px)" srcSet={portraitMobile} />
          <img src={portrait} alt="" fetchPriority="high" width="1500" height="1037" />
        </picture>
        <div className="frame hero-inner">
          <div className="hero-copy">
            <h1 id="hero-title">صحتك،<br /><span>يومًا بعد يوم.</span></h1>
            <p>سجّل ضغط الدم والسكر، وتابع أدويتك، واحتفظ بسجلّ يمكنك مراجعته مع طبيبك.</p>
            <div className="hero-actions">
              <JoinLink inverse />
              <a className="button button--outline" href="#readings">شاهد مثالًا <ArrowDown size={17} aria-hidden="true" /></a>
            </div>
          </div>
        </div>
      </section>

      <nav className="quick-nav" aria-label="أقسام الصفحة">
        <div className="frame quick-nav-inner">
          {links.map(({ href, label, icon: Icon }) => <a key={href} href={href}><Icon size={22} aria-hidden="true" /><span>{label}</span><ArrowLeft className="quick-arrow" size={16} aria-hidden="true" /></a>)}
        </div>
      </nav>

      <Readings />

      <section className="routine section" id="routine" tabIndex={-1} aria-labelledby="routine-title">
        <div className="frame routine-layout">
          <img className="routine-photo" src="/images/home-blood-pressure.webp" alt="شخصان يقيسان ضغط الدم في المنزل" loading="lazy" />
          <div className="routine-copy">
            <p className="kicker"><Pill size={20} aria-hidden="true" /> روتين المتابعة</p>
            <h2 id="routine-title">من قياس اليوم إلى موعدك القادم.</h2>
            <div className="routine-steps">
              {routines.map(({ when, title, copy }, index) => <details name="daily-routine" key={title} open={index === 0}>
                <summary><span><small>{when}</small><strong>{title}</strong></span><ChevronDown size={21} aria-hidden="true" /></summary>
                <p>{copy}</p>
              </details>)}
            </div>
          </div>
        </div>
      </section>

      <section className="doctor" id="doctor" tabIndex={-1} aria-labelledby="doctor-title">
        <div className="frame doctor-layout">
          <div className="section-copy">
            <p className="kicker"><ClipboardList size={20} aria-hidden="true" /> زيارة الطبيب</p>
            <h2 id="doctor-title">خذ سجلّك معك إلى موعدك.</h2>
            <p>راجع قراءاتك وجرعاتك قبل الزيارة. يمكنك مشاركة سجلّك مع طبيب مرتبط بحسابك بعد موافقتك على المشاركة.</p>
            <a className="text-link" href="#readings">استعرض مثال القياسات <ArrowLeft size={18} aria-hidden="true" /></a>
          </div>
          <img src={consultation} alt="طبيبة تتحدث مع مراجع في العيادة" loading="lazy" />
        </div>
      </section>

      <section className="closing" aria-labelledby="closing-title">
        <div className="frame closing-inner">
          <h2 id="closing-title">ابدأ سجلّك الصحي اليوم.</h2>
          <JoinLink inverse />
        </div>
      </section>
    </main>

    <footer className="footer">
      <div className="frame footer-inner">
        <Brand />
        <nav aria-label="روابط التذييل"><a href="/login">تسجيل الدخول</a><a href="/register">أنشئ حسابًا</a></nav>
        <a className="top-link" href="#top">إلى الأعلى <ArrowUp size={17} aria-hidden="true" /></a>
      </div>
    </footer>
  </div>;
}
