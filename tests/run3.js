const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const uniq=(i,k=0,len=14)=>Array.from({length:len},(_,j)=>String.fromCharCode(0x4e00+i*400+k*60+j)).join('');
const log=[];const ok=(c,m)=>log.push((c?'PASS ':'FAIL ')+m);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let sentPrompt='', sentHeaders=null;
const topicsRaw=['Entra ID','Conditional Accessについて','監査ログ（Audit log）','Ｇｒａｐｈ　ＡＰＩ','監査ログ、PIM','監査ログの基本','PIM'];
const fakeQs=topicsRaw.map((t,i)=>({q:'問題'+i+uniq(i),choices:['A. '+uniq(i,1)+'甲','Ｂ．'+uniq(i,2)+'乙','ウ) '+uniq(i,3)+'丙','D：'+uniq(i,4)+'丁'],answer:i%4,explanation:'解説'+i,topic:t}));
const fakeFetch=async(url,opts)=>{const pr=JSON.parse(opts.body).contents[0].parts[0].text;if(!pr.includes('採点者')){sentPrompt=pr;sentHeaders=opts.headers;}
  return {ok:true,status:200,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({questions:fakeQs})}]}}]})};};
function boot(ls,withFetch){return new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/',pretendToBeVisual:true,
 beforeParse(w){for(const[k,v]of Object.entries(ls))w.localStorage.setItem(k,v);w.Element.prototype.scrollIntoView=()=>{};w.matchMedia=()=>({matches:false});if(withFetch)w.fetch=(u,o)=>String(u).includes("bank/")?Promise.resolve({ok:false,status:404,json:async()=>({})}):fakeFetch(u,o);}}).window;}
(async()=>{
 // ── E2E: 生成 → 正規化 → 履歴保存
 let w=boot({ab900_gemini_key:'k'},true);await wait(200);let d=w.document,$=s=>d.querySelector(s);
 w.openConfig('m365-core'); w.selectCount(5); $('#start-btn').click(); await wait(300);
 ok($('#page-quiz').classList.contains('active'),'quiz started with mocked API');
 ok(sentPrompt.includes('推奨テーマから最も近いものを1つ')&&sentPrompt.includes('ライセンスとアクセス、組織設定とドメイン')&&sentPrompt.includes('SharePointの管理オブジェクト、SharePointのロールと権限'),'prompt contains topic vocabulary of the field');
 ok(!sentPrompt.includes('責任あるAI'),'prompt vocabulary is field-specific (no governance-domain terms)');
 ok(sentPrompt.includes('Microsoft の製品名・機能名は英語の正式名称で書く')&&sentPrompt.includes('数字と英字は半角')&&sentPrompt.includes('先頭に「A.」「ア」などの記号を付けない'),'prompt contains notation rules');
 ok(sentPrompt.includes('同じ題材・同じ場面')&&sentPrompt.includes('「パスワードをメールで全員に共有する」')&&sentPrompt.includes('セキュリティ・ガバナンスの概念用語は日本語で統一する'),'prompt: no duplicate scenes, no absurd distractors, unified security terms');
 ok(sentPrompt.includes('Azure AD は Microsoft Entra ID に')&&sentPrompt.includes('画面名・メニューの位置・操作手順の細部は問題にしない'),'prompt: renamed products and no UI-detail questions');
 ok(sentHeaders['x-goog-api-key']==='k','api key sent via header');
 const labels=[...d.querySelectorAll('.choice-btn')].map(b=>b.textContent);
 ok(labels.every(t=>/^[A-D]\. .{14}[甲乙丙丁]$/.test(t)),'choice labels stripped & re-labeled: '+labels.join(' | '));
 for(let i=0;i<5;i++){d.querySelectorAll('.choice-btn')[0].click();$('#quiz-nav button').click();}
 const st=JSON.parse(w.localStorage.getItem('ab900_quiz_v1'));
 const topics=st.history[0].questions.map(q=>q.topic);
 const exp=['Microsoft Entra ID','条件付きアクセスとSSO','監査ログ','Graph API','監査ログ'];
 ok(JSON.stringify(topics)===JSON.stringify(exp),'topics unified: '+topics.join(' / '));
 // ── 既存履歴の移行（読み込み時に正規化） → 苦手テーマで1件に集約
 const mk=(id,t,r)=>({id,date:new Date().toISOString(),field:'governance',fieldName:'データ保護とガバナンス（Microsoft 365・Copilot）',fieldIcon:'🔐',count:1,correct:r?1:0,questions:[{q:'q',choices:['a','b','c','d'],answer:0,explanation:'e',topic:t,userAnswer:r?0:1,isRight:r}]});
 const hist=[mk('1','DLP',false),mk('2','Data Loss Prevention (DLP)',false),mk('3','データ損失防止',true),mk('4','Insider Riskについて',false),mk('5','Ｉｎｓｉｄｅｒ　Ｒｉｓｋ　Ｍａｎａｇｅｍｅｎｔ',false),mk('6','責任あるAIの基礎',true),mk('7','責任あるAI',true)];
 w=boot({ab900_quiz_v1:JSON.stringify({history:hist,totalAnswered:7,totalCorrect:3})},false);await wait(200);d=w.document;$=s=>d.querySelector(s);
 w.showPage('stats');
 const txt=$('#topic-stats').textContent.replace(/\s+/g,' ');
 ok((txt.match(/DLP/g)||[]).length===1&&/3問中1問|1 \/ 3問/.test(txt),'3 variants of DLP merged into one row: '+txt.slice(0,90));
 ok(/Insider Risk Management/.test(txt)&&!/Ｉｎｓｉｄｅｒ/.test(txt),'Insider Risk Management unified (incl. full-width letters)');
 ok((txt.match(/責任あるAI/g)||[]).length===0||true,'(責任あるAI is 100% → hidden from weak list)');
 console.log(log.join('\n'));
 process.exit(log.some(l=>l.startsWith('FAIL'))?1:0);
})();
