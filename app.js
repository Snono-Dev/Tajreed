// منظف الصور - يعمل بالكامل Client-Side لـ GitHub Pages
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const pickBtn = document.getElementById('pickBtn');
const results = document.getElementById('results');
const formatSel = document.getElementById('format');
const qualityInput = document.getElementById('quality');
const qVal = document.getElementById('qVal');
const maxSizeInput = document.getElementById('maxSize');
const cleanNameChk = document.getElementById('cleanName');

qualityInput.addEventListener('input', () => qVal.textContent = qualityInput.value + '%');

pickBtn.onclick = (e) => { e.stopPropagation(); fileInput.click(); };
dropzone.onclick = () => fileInput.click();
fileInput.onchange = () => handleFiles(fileInput.files);

['dragover','dragenter'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('drag'); }));
['dragleave','drop'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('drag'); }));
dropzone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
dropzone.addEventListener('keydown', e => { if (e.key === 'Enter') fileInput.click(); });
document.addEventListener('paste', e => {
  const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
  if (files.length) handleFiles(files);
});

let counter = 0;

async function handleFiles(list) {
  for (const file of list) {
    if (!file.type.startsWith('image/')) continue;
    counter++;
    await processOne(file, counter);
  }
}

// كشف البيانات الوصفية (للعرض فقط قبل/بعد)
async function inspectMetadata(file) {
  const buf = new Uint8Array(await file.slice(0, 512*1024).arrayBuffer());
  const found = [];
  const text = new TextDecoder('latin1').decode(buf.slice(0, 20000));

  if (file.type === 'image/jpeg' || buf[0] === 0xFF && buf[1] === 0xD8) {
    // امشِ على markers
    let i = 2;
    while (i + 4 < buf.length) {
      if (buf[i] !== 0xFF) break;
      const marker = buf[i+1];
      if (marker === 0xD9 || marker === 0xDA) break; // EOI / SOS
      if (marker === 0xD8 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
      const len = (buf[i+2] << 8) | buf[i+3];
      if (len < 2) break;
      const payload = new TextDecoder('latin1').decode(buf.slice(i+4, Math.min(i+4+40, i+2+len)));
      if (marker === 0xE1) {
        if (payload.includes('Exif')) found.push('EXIF');
        else if (payload.includes('http://ns.adobe.com/xap')) found.push('XMP');
        else found.push('APP1 بيانات');
      }
      if (marker === 0xED) found.push('Photoshop/IPTC');
      if (marker === 0xE2) found.push('ICC Profile');
      if (marker === 0xFE) found.push('تعليق COM');
      i += 2 + len;
      if (found.length > 6) break;
    }
    if (text.includes('GPS')) found.push('GPS');
  }
  if (file.type === 'image/png') {
    if (text.includes('eXIf')) found.push('eXIf');
    if (text.includes('tEXt')) found.push('tEXt');
    if (text.includes('iTXt')) found.push('iTXt');
    if (text.includes('zTXt')) found.push('zTXt');
    if (text.includes('iCCP')) found.push('iCCP');
  }
  if (text.includes('http://ns.adobe.com/xap')) { if(!found.includes('XMP')) found.push('XMP'); }
  if (text.includes('Photoshop')) { if(!found.includes('Photoshop/IPTC')) found.push('IPTC/Photoshop'); }
  return [...new Set(found)];
}

function loadBitmap(file) {
  // imageOrientation fromImage = تطبيق التدوير بصرياً ثم حذف الوسم
  if ('createImageBitmap' in window) {
    return createImageBitmap(file, { imageOrientation: 'fromImage', premultiplyAlpha: 'default' })
      .catch(() => createImageBitmap(file));
  }
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = rej;
    img.src = url;
  });
}

async function processOne(file, n) {
  const card = document.createElement('div');
  card.className = 'item';
  const origUrl = URL.createObjectURL(file);
  const beforeList = await inspectMetadata(file);

  card.innerHTML = `
    <div class="preview">
      <img src="${origUrl}" alt="original">
      <div class="progress"><div></div></div>
    </div>
    <div>
      <div class="meta">⏳ جاري إعادة البناء...</div>
      <div class="row"></div>
    </div>`;
  results.prepend(card);
  const bar = card.querySelector('.progress div');
  bar.style.width = '30%';

  try {
    const bmp = await loadBitmap(file);
    let w = bmp.width, h = bmp.height;
    const maxDim = parseInt(maxSizeInput.value || '0', 10);
    if (maxDim > 0 && Math.max(w, h) > maxDim) {
      const s = maxDim / Math.max(w, h);
      w = Math.round(w * s); h = Math.round(h * s);
    }

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: true });
    // لـ JPEG نملأ خلفية بيضاء (لا ألفا) حتى لا تبقى بيانات شفافية غريبة
    let outMime = formatSel.value === 'keep' ? (file.type || 'image/png') : formatSel.value;
    if (!['image/jpeg','image/png','image/webp'].includes(outMime)) outMime = 'image/png';
    if (outMime === 'image/jpeg') { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0,0,w,h); }
    ctx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();

    bar.style.width = '70%';
    const quality = parseInt(qualityInput.value, 10) / 100;

    const blob = await new Promise((res, rej) =>
      canvas.toBlob(b => b ? res(b) : rej(new Error('فشل الترميز')), outMime, quality)
    );
    // تحقق بعد التنظيف
    const cleanFile = new File([blob], 'tmp', { type: outMime });
    const afterList = await inspectMetadata(cleanFile);

    // اسم نظيف: بدون أي أثر للاسم الأصلي إذا اختار المستخدم
    const ext = outMime === 'image/jpeg' ? 'jpg' : outMime === 'image/png' ? 'png' : 'webp';
    const base = cleanNameChk.checked
      ? `clean-image-${Date.now().toString().slice(-6)}-${n}.${ext}`
      : file.name.replace(/\.[^.]+$/, '') + '-clean.' + ext;

    const cleanUrl = URL.createObjectURL(blob);
    bar.style.width = '100%';

    const beforeTxt = beforeList.length ? `<span class="status-dirty">⚠️ وُجد: ${beforeList.join('، ')}</span>` : `<span class="status-clean">لا توجد markers معروفة (لكن أُعيد البناء احترازياً)</span>`;
    const afterTxt = afterList.length ? `⚠️ ما زال: ${afterList.join('، ')}` : `<span class="status-clean">✅ نظيف — لا EXIF/GPS/XMP/IPTC</span>`;

    card.querySelector('.meta').innerHTML = `
      📁 الأصلي: <code>${escapeHtml(file.name)}</code><br>
      📐 الأبعاد: ${bmp.width}×${bmp.height} → ${w}×${h} • الحجم: ${fmt(file.size)} → <b>${fmt(blob.size)}</b><br>
      🔎 قبل: ${beforeTxt}<br>
      🛡️ بعد إعادة البناء (${outMime.split('/')[1].toUpperCase()}): ${afterTxt}<br>
      ⬇️ الاسم الجديد: <code>${escapeHtml(base)}</code>
    `;
    const row = card.querySelector('.row');
    row.innerHTML = '';

    const dl = document.createElement('a');
    dl.className = 'btn small';
    dl.textContent = '⬇️ تحميل النظيفة';
    dl.href = cleanUrl; dl.download = base;

    const viewBtn = document.createElement('a');
    viewBtn.className = 'btn small ghost';
    viewBtn.textContent = '👁️ عرض';
    viewBtn.href = cleanUrl; viewBtn.target = '_blank';

    // تحديث المعاينة للنسخة النظيفة
    const imgEl = card.querySelector('img');
    imgEl.src = cleanUrl;
    URL.revokeObjectURL(origUrl); // مسح الأصلية من الذاكرة فوراً للخصوصية

    row.append(dl, viewBtn);
    setTimeout(() => { const p = card.querySelector('.progress'); if(p) p.remove(); }, 800);

  } catch (err) {
    card.querySelector('.meta').innerHTML = `❌ فشل: ${escapeHtml(err.message)}`;
  }
}

function fmt(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
  return (b/1024/1024).toFixed(2) + ' MB';
}
function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
