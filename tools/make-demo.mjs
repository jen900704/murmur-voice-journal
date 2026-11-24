// Builds demo/demo-data.json: 40 days of SYNTHETIC entries, analyzed with the real pipeline.
// The voice-mood links in this file are built in on purpose so the Trends view has something to show.
// Run: node tools/make-demo.mjs
import { analyze, FEATURE_VERSION } from '../js/features.js';
import { writeFileSync } from 'node:fs';
const SR=16000;
let seed=3; const rnd=()=>{seed=(seed*1664525+1013904223)>>>0; return seed/4294967296;};
function speech({f0,jit,sylMs,gapMs,pauseMs,groups=5,per=6}){
  const parts=[]; const sil=ms=>new Float32Array(Math.round(ms/1000*SR));
  parts.push(sil(300));
  for(let g=0;g<groups;g++){for(let s=0;s<per;s++){const n=Math.round(sylMs*(0.8+0.4*rnd())/1000*SR);const fo=f0*(1+jit*Math.sin(g*1.3+s*0.9)+0.02*(rnd()-0.5));const t=new Float32Array(n);let ph=0;for(let i=0;i<n;i++){ph+=2*Math.PI*fo*(1+0.03*i/n)/SR;t[i]=0.3*Math.sin(Math.PI*i/n)*(Math.sin(ph)+0.5*Math.sin(2*ph)+0.25*Math.sin(3*ph));}parts.push(t);parts.push(sil(gapMs));}
    parts.push(sil(pauseMs*(0.6+0.8*rnd())));}
  const L=parts.reduce((a,p)=>a+p.length,0);const x=new Float32Array(L);let o=0;for(const p of parts){x.set(p,o);o+=p.length;}
  for(let i=0;i<L;i++)x[i]+=0.003*(rnd()-0.5); return x;
}
const entries=[];
for(let d=40; d>=1; d--){
  const mood=Math.max(1,Math.min(7,Math.round(4+2*Math.sin(d/6)+ (rnd()-0.5)*2)));
  const energy=Math.max(1,Math.min(7,Math.round(mood+(rnd()-0.5)*3)));
  const f=analyze(speech({f0:205+2*(mood-4)+16*(rnd()-0.5), jit:0.05+0.06*rnd()+0.015*mood/7, sylMs:200-5*energy+40*(rnd()-0.5), gapMs:60, pauseMs:900-40*energy+500*(rnd()-0.5)}),SR);
  entries.push({id:'demo-'+d, dayOffset: d, hour: 8 + 12 * rnd(), prompt:'', lang:'en', mood, energy, note:'', demo:true, features:f, featureVersion:FEATURE_VERSION, hasAudio:false});
}
writeFileSync(new URL('../demo/demo-data.json', import.meta.url), JSON.stringify({ app: 'murmur', version: 1, demo: true, entries }));
console.log(entries.length, entries.slice(-3).map(e=>[e.mood,e.features.f0MedianHz,e.features.speechRate,e.features.pauseRatio]));
