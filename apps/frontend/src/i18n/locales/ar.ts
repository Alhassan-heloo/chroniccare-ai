export const arCatalog = {
  common: {
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
