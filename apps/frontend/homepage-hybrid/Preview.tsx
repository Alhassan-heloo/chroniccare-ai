import { useEffect, useState } from 'react';
import Homepage from './Homepage';
import { copy, type Language } from './copy';

export default function Preview() {
  const params = new URLSearchParams(location.search);
  const [language, setLanguage] = useState<Language>(() => params.get('lang') === 'en' ? 'en' : 'ar');
  const [dark, setDark] = useState(() => params.get('theme') === 'dark' || (params.get('theme') !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches));

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.title = `ChronicCare AI | ${copy[language].title}`;
  }, [language]);

  function changeLanguage(next: Language) {
    const url = new URL(location.href);
    url.searchParams.set('lang', next);
    url.searchParams.set('theme', dark ? 'dark' : 'light');
    history.replaceState(history.state, '', url);
    setLanguage(next);
  }

  return <Homepage language={language} dark={dark} onLanguage={changeLanguage} onTheme={() => setDark(value => !value)} />;
}
