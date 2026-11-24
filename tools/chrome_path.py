"""Part B, condition 2: record each clip through Chrome's fake microphone with the app's own
MediaRecorder path, and compare the stored features with the clean analysis.
Usage: python3 -I tools/chrome_path.py <wav-dir> <clean-f32-dir> <app-url>
"""
import asyncio, json, os, subprocess, sys
import soundfile as sf
from playwright.async_api import async_playwright

WAV, F32, URL = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__))
FEATURES = ["f0MedianHz", "f0SdSt", "f0RangeSt", "speechRate", "articulationRate", "pauseRatio", "meanPauseS", "intensitySdDb", "periodicityDb"]

async def record(p, wav):
    dur = sf.info(wav).duration
    b = await p.chromium.launch(executable_path=os.environ.get('CHROME_PATH') or None, args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', f'--use-file-for-fake-audio-capture={wav}%noloop'])
    ctx = await b.new_context(permissions=['microphone'], locale='en-US')
    page = await ctx.new_page()
    await page.goto(URL)
    await page.click('.rec-btn')
    await page.wait_for_timeout(int((dur + 0.6) * 1000))
    await page.click('.rec-btn')
    await page.wait_for_selector('.result-head, .error', timeout=30000)
    if await page.query_selector('.error'):
        await b.close()
        return None
    await page.click('[data-key="save"]')
    await page.wait_for_timeout(400)
    e = await page.evaluate("""new Promise(r=>{const q=indexedDB.open('murmur');q.onsuccess=()=>{const t=q.result.transaction('entries').objectStore('entries').getAll();t.onsuccess=()=>r(t.result[0])}})""")
    await b.close()
    return e

async def main():
    out = {}
    async with async_playwright() as p:
        for c in ['jfk', 'lj', 'libri_f', 'libri_m1', 'libri_m2']:
            e = await record(p, os.path.join(WAV, c + '.wav'))
            clean = json.loads(subprocess.run(['node', os.path.join(HERE, 'murmur-analyze.mjs'), os.path.join(F32, c + '.f32')], capture_output=True, text=True).stdout)
            out[c] = {'capture': e and e.get('capture'), 'chrome': e and {f: e['features'][f] for f in FEATURES}, 'clean': {f: clean[f] for f in FEATURES}}
            if e:
                print(c, e['capture']['mimeType'], ' '.join(f"{f[:8]}:{clean[f]}->{e['features'][f]}" for f in FEATURES))
            else:
                print(c, 'rejected')
    print(json.dumps(out))

asyncio.run(main())
