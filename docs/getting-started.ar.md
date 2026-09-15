# ابدأ هنا

**اللغات:** [English](getting-started.md) · [Nederlands](getting-started.nl.md) · [العربية](getting-started.ar.md)

SCAYVO أداة تطوير **محلية**. أبقِ سيرفر Vite على loopback. لا تعرض `/__scayvo/` على شبكة مشتركة.

## تشغيل Halo Supply على هذا الجهاز

من **جذر المستودع**:

```bash
npm install
npm run build
npm install --prefix examples/demo
npm run start --prefix examples/demo -- --host 127.0.0.1 --port 4173 --strictPort
```

ثم افتح:

- التطبيق: http://127.0.0.1:4173/dashboard
- المخرج: http://127.0.0.1:4173/__scayvo/

`npm run demo` يشغّل نفس عملية Vite لكن **ما يمرّر** `--host` / `--port`. Playwright وهذا الدليل يثبّتان **4173**. إذا المنفذ مشغول، أوقف العملية الثانية؛ لا تشاركه مع Playwright (`reuseExistingServer` مطفأ).

تطبيق مشهد عبر CLI (Vite شغال؛ من `examples/demo` حتى يقرأ `.scayvo/runtime.json`):

```bash
cd examples/demo
npx scayvo list
npx scayvo run busy
npx scayvo run payment-failed
npx scayvo reset
```

`run` يتكلم مع الجلسة الحية ويتوقف فقط بعد `SCENE_APPLIED`. ما يشغّل Vite وما يفتح متصفح. ما فيه `--base-url` — الهوست والتوكن من `.scayvo/runtime.json`.

## 1. الحزمة

ابنِ هذا الريبو وثبّت الـ tarball بـ `npm pack`. لا تحمّل حزمة `scayvo` غير ذات صلة من السجل العام كبديل.

## 2. الإعداد

`scayvo.config.ts` TypeScript محلي موثوق يحمّله Node. معرّفات المشاهد kebab-case صغيرة. `order` يذكر كل مشهد مرة. `initialScene` لازم يكون في القائمة.

الـ fixtures نسبية لملف الإعداد، تُقرأ في Node، تُتحقق كـ JSON، ثم تُضمَّن للمتصفح. المسارات المطلقة والخروج بالروابط الرمزية خارج جذر المشروع تفشل قبل أي تغيير للمشهد.

## 3. ثلاث لمسات في التطبيق

1. `scayvo()` في `vite.config.ts`
2. `src/scayvo.dev.ts` — المحولات + `startScayvo({ integration })`
3. استيراد ديناميكي داخل `import.meta.env.DEV` في `main` حتى بناء الإنتاج يحذف الجلسة

انتظر جاهزية العامل قبل استيراد وحدات تستدعي `fetch`. MSW يوثّق هذا السباق؛ SCAYVO يتبعه.

## 4. عقد التركيب

`mount(context)` ينحل بعد أول هيكل صالح، مو بعد كل طلب شبكة. عشان كذا Slow API يقدر يكون **Active** والهيكل لسا على الشاشة.

`dispose()` يلغي الجلب والتايمر والاشتراكات ثم يفك الجذر.

## 5. المصافحة

المخرج يعرض **Connected** بعد مصادقة التطبيق، و**Active** فقط بعد `SCENE_APPLIED`. CLI `run` ينتظر نفس الإقرار. اتصال السوكت وحده مو نجاح.

## 6. جولة المثال

استخدم `examples/demo` لتسجيل Empty → Busy → Slow → Error → Pay (مرفوض) → Replay → Premium. الإيراد لازم يجي من صفوف الـ fixture الثلاثة ($977.00)، مو من رقم عنوان مكتوب يدويًا.
