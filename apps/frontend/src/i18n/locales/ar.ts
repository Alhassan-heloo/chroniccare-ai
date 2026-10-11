export const arCatalog = {
  common: {
    reminder: { glucose: "قياس السكر", evening: "اليوم، الساعة 10 مساءً" },
    layout: { space: "مساحتي الصحية", daily: "متابعة يومية", demo: "عرض تجريبي", notifications: "التنبيهات", showNotifications: "عرض التنبيهات", account: "حساب المريض", caption: "مساحتك الصحية", mainNav: "القائمة الرئيسية", start: "صحتك تبدأ بخطوة", noteFirst: "متابعة بسيطة كل يوم،", noteLast: "واهتمام يدوم.", demoVersion: "نسخة تجريبية", mobileNav: "التنقل على الجوال", health: "صحتي", assistant: "المساعد", more: "المزيد", showMore: "عرض المزيد من الصفحات", notificationDemo: "تنبيه تجريبي داخل التطبيق؛ الإشعارات الفعلية غير مفعلة.", skip: "تجاوز إلى المحتوى", footer: "متابعة يومية، بخطوات بسيطة.", brandHome: "ChronicCare AI، الصفحة الرئيسية", brandTagline: "معًا نحو حياة أكثر صحة" },
    preferences: { enableLight: "تفعيل المظهر الفاتح", enableDark: "تفعيل المظهر الداكن", lightTooltip: "المظهر الفاتح", darkTooltip: "المظهر الداكن", switchEnglish: "Switch to English", switchArabic: "التبديل إلى العربية", arabic: "العربية", english: "EN" },
    navigation: { home: "الرئيسية", measurements: "صحتي وقياساتي", medications: "أدويتي", habits: "عاداتي اليومية", reports: "التقارير", assistant: "المساعد الصحي", profile: "حسابي" },
    chart: { pressureDescription: "اتجاه قراءات الضغط المسجلة خلال آخر 7 أيام، بوحدة mmHg", glucoseDescription: "اتجاه قراءات السكر المسجلة خلال آخر 7 أيام، بوحدة mg/dL", systolic: "الانقباضي", diastolic: "الانبساطي", glucose: "السكر" },
    actions: {
      cancel: "إلغاء",
      close: "إغلاق",
      delete: "حذف",
      edit: "تعديل",
      retry: "إعادة المحاولة",
      save: "حفظ",
    },
    state: {
      loading: "جارٍ التحميل…",
      noData: "لا توجد بيانات",
    },
    theme: {
      label: "نمط المظهر",
      light: "فاتح",
      dark: "داكن",
      system: "النظام",
    },
  },
  auth: {
    signIn: "تسجيل الدخول",
    register: "إنشاء حساب",
  },
  patient: {
    dashboard: {
      title: "الرئيسية",
      welcome: "مرحبًا {{name}}",
      summary: "هذا ملخص صحتك اليوم",
      loading: "جارٍ تحميل ملخص صحتك…",
      error: "تعذر تحميل البيانات",
    },
  },
  measurements: {
    title: "صحتي وقياساتي",
    add: "إضافة قراءة جديدة",
    bloodPressure: "ضغط الدم",
    bloodGlucose: "سكر الدم",
    empty: "لا توجد قراءات مطابقة",
  },
  medications: {
    title: "أدويتي",
    add: "إضافة دواء",
    empty: "لا توجد أدوية مسجلة",
    dosesTaken: "جرعات تم تناولها",
  },
  habits: {
    title: "عاداتي اليومية",
    add: "إضافة عادة",
    empty: "ابدأ بعادتك الأولى",
    completed: "مكتملة",
  },
  reports: {
    title: "تقاريري",
    period: "فترة التقرير",
    loadingChart: "جارٍ تحميل المخطط…",
    noReadings: "لا توجد قراءات خلال الفترة.",
  },
  doctor: {
    dashboard: "لوحة الطبيب",
    patients: "مرضاي",
  },
  admin: {
    dashboard: "لوحة الإدارة",
  },
  validation: {
    required: "هذا الحقل مطلوب",
    invalidNumber: "أدخل رقمًا صحيحًا",
    operationFailed: "تعذر تنفيذ العملية. حاول مرة أخرى.",
  },
} as const;
