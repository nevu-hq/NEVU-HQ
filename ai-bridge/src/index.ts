import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, Page } from 'playwright';

const PORT=Number(process.env.NEVU_BRIDGE_PORT||8787);
const SECRET=process.env.NEVU_BRIDGE_SECRET||'';
const ROOT=path.resolve(process.env.NEVU_BRIDGE_PROFILE_DIR||'./profiles');
const HEADLESS=process.env.NEVU_BRIDGE_HEADLESS==='true';
fs.mkdirSync(ROOT,{recursive:true});

type Platform='chatgpt'|'claude'|'gemini'|'grok'|'llama'|'auto';
const configs:Record<Exclude<Platform,'auto'>,{url:string; inputs:string[]; sends:string[]; responses:string[]}>={
 chatgpt:{url:'https://chatgpt.com/',inputs:['#prompt-textarea','textarea[placeholder*="Message"]','[contenteditable="true"]'],sends:['button[data-testid="send-button"]','button[aria-label*="Send"]'],responses:['div[data-message-author-role="assistant"]','.markdown-prose']},
 claude:{url:'https://claude.ai/new',inputs:['div[contenteditable="true"]','textarea'],sends:['button[aria-label*="Send"]','button[type="submit"]'],responses:['[data-is-streaming]','.font-claude-message','div[class*="font-claude"]']},
 gemini:{url:'https://gemini.google.com/app',inputs:['textarea[placeholder*="Enter a prompt"]','rich-textarea div[contenteditable="true"]','textarea'],sends:['button[aria-label*="Send"]','button[aria-label*="send"]'],responses:['message-content','.model-response-text','div[class*="response-content"]']},
 grok:{url:'https://grok.com/',inputs:['textarea','[contenteditable="true"]'],sends:['button[aria-label*="Send"]','button[type="submit"]'],responses:['[data-testid*="message"]','article']},
 llama:{url:'https://huggingface.co/chat/',inputs:['textarea','[contenteditable="true"]'],sends:['button[type="submit"]','button[aria-label*="Send"]'],responses:['div.prose','article','[data-message-author-role="assistant"]']}
};
async function first(page:Page, selectors:string[], timeout=20000){for(const s of selectors){try{const loc=page.locator(s).last();await loc.waitFor({state:'visible',timeout:Math.min(timeout,4000)});return loc}catch{}}throw new Error(`No usable selector found. The provider UI may have changed: ${selectors.join(', ')}`)}
async function run(platform:Exclude<Platform,'auto'>,prompt:string){const cfg=configs[platform];const profile=path.join(ROOT,platform);const ctx=await chromium.launchPersistentContext(profile,{headless:HEADLESS,viewport:{width:1440,height:900}});const page=ctx.pages()[0]||await ctx.newPage();await page.goto(cfg.url,{waitUntil:'domcontentloaded',timeout:60000});let input;try{input=await first(page,cfg.inputs,20000)}catch{await ctx.close();throw new Error(`${platform} needs a manual login or its input could not be found. Run the bridge with headless=false and sign in in the opened browser profile.`)}await input.fill(prompt);let send;try{send=await first(page,cfg.sends,8000);await send.click()}catch{await input.press('Enter')}let last='';let stable=0;const started=Date.now();while(Date.now()-started<180000){await page.waitForTimeout(1200);for(const selector of cfg.responses){const loc=page.locator(selector).last();if(await loc.count()){try{const text=(await loc.innerText()).trim();if(text&&text!==last){last=text;stable=0}else if(text){stable++}if(stable>=4&&last)break}catch{}}}if(stable>=4&&last)break}if(!last)throw new Error('No response was captured. Check the provider login and current page UI.');await ctx.close();return last}
function choosePlatform(p:string):Exclude<Platform,'auto'>{if(p!=='auto')return p as any;return (process.env.NEVU_BRIDGE_DEFAULT_PROVIDER||'chatgpt') as any}
const server=http.createServer(async(req,res)=>{res.setHeader('content-type','application/json');res.setHeader('access-control-allow-origin','*');if(req.method==='GET'&&req.url==='/health'){res.end(JSON.stringify({ok:true,service:'nevu-ai-bridge'}));return}if(req.headers['x-nevu-secret']!==SECRET){res.statusCode=401;res.end(JSON.stringify({error:'Unauthorized'}));return}if(req.method!=='POST'||req.url!=='/run'){res.statusCode=404;res.end(JSON.stringify({error:'Not found'}));return}let body='';req.on('data',c=>body+=c);req.on('end',async()=>{try{const j=JSON.parse(body);const platform=choosePlatform(String(j.platform||'chatgpt'));const response=await run(platform,String(j.prompt||''));res.end(JSON.stringify({ok:true,platform,response}))}catch(e){res.statusCode=500;res.end(JSON.stringify({error:e instanceof Error?e.message:String(e)}))}})});
server.listen(PORT,()=>console.log(`NEVU AI Bridge listening on http://127.0.0.1:${PORT}`));
