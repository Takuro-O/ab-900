// 旧名称の自動除外と、既存の正解のプロンプト受け渡し
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const log=[];const ok=(c,m)=>log.push((c?'PASS ':'FAIL ')+m);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const uniq=(i,k=0,len=14)=>Array.from({length:len},(_,j)=>String.fromCharCode(0x4e00+i*400+k*60+j)).join('');
const mk=(i,extra={})=>({q:'問題'+i+uniq(i),choices:[uniq(i,1)+'甲',uniq(i,2)+'乙',uniq(i,3)+'丙',uniq(i,4)+'丁'],answer:0,explanation:'解説'+i,topic:'ユーザーとグループ',...extra});
let sent='';
const fakeQs=[mk(0),mk(1,{choices:['Azure AD '+uniq(1,1),uniq(1,2),uniq(1,3),uniq(1,4)]}),mk(2,{q:'Azure Active Directory を使う'+uniq(2)}),
  mk(3,{explanation:'Azure AD は Microsoft Entra ID に改称されました。'}),mk(4),mk(5),mk(6)];
const fakeFetch=async(url,opts)=>{const pr=JSON.parse(opts.body).contents[0].parts[0].text;if(!pr.includes('採点者'))sent=pr;
  return {ok:true,status:200,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({questions:fakeQs})}]}}]})};};
const rec=(id,field,ans)=>({id,date:new Date().toISOString(),field,fieldName:field,fieldIcon:'x',count:1,correct:1,
  questions:[{q:'既存'+id,choices:['x1','x2','x3','x4'].map((c,i)=>i===1?ans:c),answer:1,explanation:'e',topic:'t',userAnswer:1,isRight:true}]});
function boot(ls){return new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/',pretendToBeVisual:true,
 beforeParse(w){for(const[k,v]of Object.entries(ls))w.localStorage.setItem(k,v);w.fetch=fakeFetch;w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});}}).window;}
(async()=>{
  const hist={history:[rec('a','m365-core','基礎の既存の正解ABC'),rec('b','governance','ガバナンスの既存の正解XYZ')],totalAnswered:0,totalCorrect:0};
  const w=boot({ab900_gemini_key:'k',ab900_quiz_v1:JSON.stringify(hist)});await wait(200);const d=w.document;
  w.openConfig('m365-core');w.selectCount(5);d.getElementById('start-btn').click();await wait(400);
  ok(sent.includes('【すでにある問題の正解】')&&sent.includes('基礎の既存の正解ABC'),'prompt lists same-domain existing answers');
  ok(!sent.includes('ガバナンスの既存の正解XYZ'),'prompt excludes other-domain answers');
  const prog=JSON.parse(w.localStorage.getItem('ab900_quiz_progress_v1')||'null');
  const qs=prog?prog.questions:[];
  const all=JSON.stringify(qs);
  ok(qs.length===5,'5 questions started: '+qs.length);
  ok(!/Azure AD \S|Azure Active Directory/i.test(all.replace(/Azure AD は Microsoft Entra ID/,'')),'old names in question/choices dropped');
  ok(all.includes('Azure AD は Microsoft Entra ID に改称'),'old name allowed in explanation');
  console.log(log.join('\n'));process.exit(log.some(l=>l.startsWith('FAIL'))?1:0);
})();
