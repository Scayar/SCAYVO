# التكاملات

**اللغات:** [English](integrations.md) · [Nederlands](integrations.nl.md) · [العربية](integrations.ar.md)

## React + Vite SPA

البيئة المدعومة: Chromium محلي، `base: '/'`، REST عبر `fetch`.

استخدم `scayvo/react` إذا تبي `createReactIntegration(target, render)` اللي يسوي `flushSync` لأول commit ثم يفك التركيب.

وإلا نفّذ `AppIntegration` بنفس القواعد:

- `QueryClient` / store جديد لكل جيل، أو محول يصفّرهم
- ألغِ الاستعلامات الجارية ومرّر `AbortSignal` إلى `fetch`
- لا تُبقِ متفردات مصادقة أو كاش خارج `mount`/`dispose`

## المحولات

```ts
type Adapter = {
  capture(): Json | Promise<Json>
  apply(value: Json, context: SceneContext): Promise<void>
  restore(snapshot: Json, context: SceneContext): Promise<void>
}
```

ترتيب التسجيل هو ترتيب التطبيق. المفاتيح المخصّصة أسماء محولات. مشهد يسمّي محولًا غير مسجّل يفشل الفحص المسبق (`ADAPTER_MISSING`) وما يغيّر المشهد الحالي.

`capture` يشتغل قبل أول مشهد، بعد ما مصادر المحول جاهزة. القيم لازم تكون JSON. `apply` / `restore` يفحصون `context.signal` قبل الالتزام. المحولات اللي تكتب لباكند حقيقي أو ترسل رسائل غير صالحة في v0.1.

TanStack Query وZustand والمكتبات المشابهة ما تُربط تلقائيًا. محول صغير يتخلص من العميل القديم وينشئ واحدًا جديدًا هو التوسعة المقصودة، مو إضافة إطار عمل.

## MSW

SCAYVO يملك عامل الجلسة. عمال التطبيق الموجودة على نفس النطاق تعارض. لا تستدعِ `worker.resetHandlers()` متوقعًا المرور؛ Reset يوقف اعتراض SCAYVO بعد الهدوء، يستعيد المدخلات، ثم `mountNormal`.

## هاش الإعداد

الجلسة تثبّت هاش إعداد عند الإقلاع. تعديل `scayvo.config.ts` أثناء عرض حي يظهر **Configuration changed**. Reset ثم أعد التحميل. HMR للإعداد مؤجّل. HMR لـ React مسموح فقط إذا متفرد المحرك على `window.__SCAYVO__` محفوظ.
