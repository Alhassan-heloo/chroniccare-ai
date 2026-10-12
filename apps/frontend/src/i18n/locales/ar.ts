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
    metric: { progress: "تقدم {{label}}", goal: "{{value}}% من هدف اليوم", walking: "المشي اليومي", water: "شرب الماء" },
    overview: { eyebrow: "كل يوم، خطوة لصحة أفضل", metrics: "ملخص القياسات اليومية", example: "بيانات مثال", recorded: "قراءة مسجلة", noReading: "لا توجد قراءة مسجلة", activity: "النشاط", steps: "خطوة من {{goal}}", tasks: "ماذا علي أن أفعل اليوم؟", routine: "روتين بسيط يصنع فرقًا", today: "مهام اليوم", weeklyLoading: "جارٍ تحميل الملخص الأسبوعي…", demo: "هذه نسخة تجريبية ببيانات توضيحية مميزة بوسم «بيانات مثال». لا تخضع القراءات لتقييم طبي.", weekly: "صحتك خلال الأسبوع", readings: "نظرة على قراءاتك", includesExamples: "يتضمن بيانات مثال", chartType: "نوع مخطط الملخص", weeklyEmpty: "لا توجد قراءات من هذا النوع خلال آخر 7 أيام.", textReadings: "عرض القراءات كنص", nextDose: "أول موعد غير مسجل اليوم: {{time}}", allTaken: "تم تسجيل تناول جميع الجرعات", addMedication: "أضف دواءك ومواعيده من صفحة أدويتي", taken: "تم التناول", update: "تحديث", inProgress: "قيد الإنجاز", habitProgress: "{{value}} / {{target}} {{unit}}", stepsUnit: "خطوة", cupsUnit: "كوب", minutesUnit: "دقيقة", timesUnit: "مرة", companion: "رفيق رحلتك الصحية", assistantQuestion: "كيف يمكنني مساعدتك اليوم؟", askAssistant: "اسأل المساعد", assistantUnavailable: "قريبًا · غير متصل بالذكاء الاصطناعي" },
    dashboard: {
      title: "الرئيسية",
      welcome: "مرحبًا {{name}}",
      summary: "هذا ملخص صحتك اليوم",
      loading: "جارٍ تحميل ملخص صحتك…",
      error: "تعذر تحميل البيانات",
    },
  },
  measurements: {
    ui: { eyebrow: "خطوة بخطوة، تابع صحتك", description: "سجل قراءاتك وراجعها في مكان واحد.", notice: "نسخة تجريبية: يبدأ السجل بأمثلة لآخر 7 أيام. التغييرات مؤقتة وتعود أمثلة البداية عند تحديث الصفحة. لا يتم تقييم القراءات طبيًا.", loading: "جارٍ تحميل القياسات…", loadError: "تعذر تحميل سجل القياسات.", history: "سجل القراءات", count: "{{shown}} من {{total}} قراءة", adjustRange: "عدّل الفترة الزمنية لعرض النتائج.", first: "ابدأ بأول قراءة", firstDescription: "أضف قياس الضغط أو السكر ليظهر هنا وفي لوحة المريض.", noMatches: "لا توجد قراءات مطابقة", broaden: "جرّب نوعًا آخر أو وسّع الفترة الزمنية.", showAll: "عرض جميع القراءات", edit: "تعديل القراءة", deleteTitle: "حذف القراءة؟", deleteQuestion: "هل تريد حذف قراءة {{kind}} {{value}}؟ لا يمكن التراجع عن الحذف.", deleteHint: "ستعرض لوحة المريض القراءة السابقة من نفس النوع، أو المثال الافتراضي إذا أصبح السجل فارغًا.", deleting: "جارٍ الحذف…", confirmDelete: "تأكيد الحذف", formNotice: "قراءة تجريبية، تحفظ حتى إعادة تحميل الصفحة.", readingKind: "نوع القراءة", systolic: "الضغط الانقباضي", diastolic: "الضغط الانبساطي", saving: "جارٍ الحفظ…", saveChanges: "حفظ التعديلات", saveReading: "حفظ القراءة", filterKind: "نوع القياس", all: "كل القياسات", from: "من تاريخ", to: "إلى تاريخ", invalidRange: "اختر تاريخًا يساوي تاريخ البداية أو يأتي بعده", clear: "مسح الفلاتر", rangeHint: "يشمل البحث يوم البداية والنهاية حسب توقيت جهازك.", example: "بيانات مثال", editLabel: "تعديل قراءة {{kind}} {{time}}", deleteLabel: "حذف قراءة {{kind}} {{time}}", saved: "تم حفظ القراءة مؤقتًا", updated: "تم تعديل القراءة", deleted: "تم حذف القراءة", failed: "تعذر تنفيذ العملية. حاول مرة أخرى.", invalidNumber: "أدخل رقمًا صحيحًا", positive: "يجب أن تكون القيمة أكبر من صفر", checkReading: "تحقق من القراءة", integer: "أدخل عددًا صحيحًا", diastolicOrder: "الضغط الانبساطي يجب أن يكون أقل من الانقباضي" },
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
    completedSingle: "{{completed}} من {{total}} عادة مكتملة",
    ui: { eyebrow: "خطوات صغيرة، كل يوم", description: "حدد أهدافك وسجّل ما أنجزته اليوم.", notice: "بيانات تجريبية مؤقتة. يبدأ تقدم يوم جديد من صفر حسب توقيت جهازك، وتعود أمثلة البداية عند تحديث الصفحة.", loading: "جارٍ تحميل العادات…", error: "تعذر تحميل العادات", achievement: "إنجاز اليوم", completedSummary: "{{completed}} من {{total}} عادات مكتملة", completedLabel: "العادات المكتملة اليوم", emptyDescription: "اختر هدفًا يوميًا مناسبًا لك.", edit: "تعديل العادة", record: "تسجيل تقدم اليوم", deleteTitle: "حذف العادة؟", deleteQuestion: "هل تريد حذف «{{name}}» وتقدمها المسجل؟ لا يمكن التراجع.", confirmDelete: "تأكيد الحذف", progress: "{{value}} من {{target}} {{unit}}", inProgress: "قيد الإنجاز", progressLabel: "تقدم {{name}}", percent: "{{value}}% من الهدف", exceeded: "تجاوزت الهدف المسجل", name: "اسم العادة", unit: "وحدة القياس", target: "الهدف اليومي", advice: "حدد الهدف المناسب لك. الأهداف الافتراضية أمثلة وليست توصيات صحية.", changeHint: "تغيير الوحدة يصفر تقدم اليوم؛ تغيير الهدف يبقي المقدار المسجل.", save: "حفظ العادة", totalToday: "إجمالي ما أنجزته اليوم ({{unit}})", progressHint: "هذه القيمة تستبدل إجمالي اليوم، ولا تضاف إليه. يمكنك إدخال صفر لإلغاء تقدم اليوم.", saveProgress: "حفظ التقدم", added: "تمت إضافة العادة", updated: "تم تعديل العادة", deleted: "تم حذف العادة", progressUpdated: "تم تحديث تقدم اليوم", failed: "تعذر تحديث العادة. حاول مرة أخرى.", invalidName: "أدخل اسم العادة", longName: "الاسم طويل جدًا", numericGoal: "أدخل هدفًا رقميًا", integer: "أدخل عددًا صحيحًا", positiveGoal: "يجب أن يكون الهدف أكبر من صفر", checkGoal: "تحقق من الهدف", invalidNumber: "أدخل رقمًا صحيحًا", negative: "لا يمكن أن يكون التقدم سالبًا", checkValue: "تحقق من القيمة" },
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
