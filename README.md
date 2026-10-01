# 🛡️ منظف الصور — إزالة البيانات الوصفية

موقع static يعمل على **GitHub Pages** (بدون سيرفر).
الزائر يرفع صورة → الموقع يحذف كل بيانات التتبع (EXIF / GPS / XMP / IPTC / thumbnails / تعليقات) → يعيد **بناء الصورة من البيكسلات فقط** عبر Canvas → تحميل نسخة نظيفة.

## 🚀 النشر على GitHub Pages

```bash
cd snono-Dev
git init
git add .
git commit -m "image cleaner"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

ثم من GitHub: `Settings → Pages → Deploy from branch → main → / (root)` وستحصل على رابط `https://USERNAME.github.io/REPO/`

## 🔒 كيف يضمن الخصوصية؟

1. لا يوجد أي `fetch` / رفع — كل المعالجة في `app.js` داخل المتصفح.
2. الصورة تُفك إلى بيكسلات خام `createImageBitmap / drawImage`.
3. ملف جديد يُولّد بـ `canvas.toBlob()` — المتصفح يكتب ترويسة نظيفة فقط، فلا ينتقل أي `APP1/APP13/COM/tEXt/eXIf`.
4. التدوير يُطبق بصرياً ثم يُحذف وسم `Orientation`.
5. اسم الملف الجديد مولّد (`clean-image-...`) بدون أي أثر للاسم الأصلي.
6. `URL.revokeObjectURL` يمسح الأصلية من الذاكرة فوراً.

## 📁 الملفات

- `index.html` — الواجهة (عربي RTL)
- `styles.css` — التصميم
- `app.js` — منطق التنظيف + فاحص markers قبل/بعد
- `.nojekyll` — لضمان عمل Pages

## ✨ مزايا

- سحب وإفلات + لصق + اختيار متعدد
- اختيار الصيغة (نفس الأصلية / JPEG / PNG / WebP) والجودة وإعادة التحجيم
- فحص قبل/بعد يعرض ما تم حذفه
- يعمل Offline بعد أول تحميل
