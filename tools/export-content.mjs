// Writes docs/content-review.md: every theory-lens question and bedtime script in Chinese,
// in one place, so the owner (or a supervisor) can review the clinical content quickly.
// Run: node tools/export-content.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LENSES } from '../js/lenses.js';
import { TRACKS, buildScript } from '../js/bedtime.js';

const TOPIC_ZH = { work: '學業或工作', relationship: '伴侶或朋友', family: '家人', self: '自己', loss: '失落或悲傷', other: '其他' };
export function buildContent() {
const out = [];
out.push('# 內容審閱清單');
out.push('');
out.push('這份檔案由 `tools/export-content.mjs` 從程式碼產生，請不要直接修改；要改內容請改 `js/lenses.js` 或 `js/bedtime.js`，再重新執行一次。');
out.push('');
out.push('審閱時可以看：問題是否忠於該取向（Corey 的章節標在標題旁）、是否適合一個人自己做、有沒有責怪或病理化的語氣、在台灣讀起來是否自然。');
out.push('');
out.push('## 換個角度看看（14 個取向）');
out.push('');
for (const l of LENSES) {
  const z = l.zh;
  out.push(`### ${z.name}（Corey 第 ${l.chapter} 章）`);
  out.push('');
  if (l.excludeTopics.length) out.push(`不提供給這些主題：${l.excludeTopics.map((t) => TOPIC_ZH[t] || t).join('、')}`, '');
  out.push(`- [ ] **核心想法：** ${z.idea}`);
  z.steps.forEach((s, i) => {
    out.push(`- [ ] **第 ${i + 1} 題：** ${s.q}`);
    if (s.why) out.push(`  - 為什麼這樣問：${s.why}`);
  });
  out.push(`- [ ] **看見的（摘要）：** ${z.noticed}`);
  out.push(`- [ ] **小實驗：** ${z.experiment}`);
  out.push(`- [ ] **可能忽略的：** ${z.misses}`);
  out.push(`- 關鍵概念：${z.concepts.join('、')}`);
  out.push('');
}
out.push(`## 睡前引導（${TRACKS.length} 段）`);
out.push('');
out.push('每段都由開頭、放下心事、主體、結尾組成；下面是不選主題時的完整稿。數字是每句後的停頓秒數。');
out.push('');
for (const t of TRACKS) {
  out.push(`### ${t.zh.name}（${t.zh.style}）`);
  out.push('');
  for (const [line, pause] of buildScript(t.id, null, 'zh-TW')) out.push(`- [ ] ${line}（${pause} 秒）`);
  out.push('');
}
return out.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(new URL('../docs/content-review.md', import.meta.url), buildContent());
  console.log('wrote docs/content-review.md');
}
