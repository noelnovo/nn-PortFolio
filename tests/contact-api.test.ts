// @vitest-environment node
import {beforeEach, expect, it, vi} from 'vitest';
import handler from '../src/pages/api/contact';
import {isBrowser, isMobile, canUseDOM, isApple} from '../src/config';

let sequence = 0;
function request(overrides: any = {}) {
  return {method:'POST', headers:{}, socket:{remoteAddress:`fixture-${sequence++}`}, body:{name:' Visitor ', email:'visitor@example.com', message:' Hello '}, ...overrides} as any;
}
function response() {
  const res: any = {setHeader:vi.fn(), json:vi.fn()};
  res.status = vi.fn(() => res); return res;
}
beforeEach(() => {
  vi.stubEnv('MAIL_GATEWAY_URL', 'https://mail.example/');
  vi.stubEnv('MAIL_GATEWAY_API_KEY', 'synthetic-only');
  vi.stubEnv('CONTACT_TO', 'recipient@example.com');
});

it('allows POST only and validates bounded fields without contacting mail', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const get = response(); await handler(request({method:'GET'}), get);
  expect(get.setHeader).toHaveBeenCalledWith('Allow','POST'); expect(get.status).toHaveBeenCalledWith(405);
  for (const body of [null, {}, {name:42}, {name:'Visitor',email:'a@b.c'},
    ...['a@@b.c','a@b','a @b.c','@b.c','a@b.'].map(email => ({name:'Visitor',email,message:'Hi'}))]) {
    const res=response(); await handler(request({body}),res); expect(res.status).toHaveBeenCalledWith(400);
  }
  expect(fetch).not.toHaveBeenCalled();
});

it('rate limits repeated forwarded IPs and expires the sliding window', async () => {
  const now=vi.spyOn(Date,'now').mockReturnValue(0);
  const req=request({headers:{'x-forwarded-for':['fixture-rate, proxy']}});
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true})));
  for (let i=0;i<5;i++) {const res=response(); await handler(req,res); expect(res.status).toHaveBeenCalledWith(200);}
  const limited=response(); await handler(req,limited); expect(limited.status).toHaveBeenCalledWith(429);
  now.mockReturnValue(600001);
  const reset=response(); await handler(req,reset); expect(reset.status).toHaveBeenCalledWith(200);
});

it('fails closed on missing mail configuration, upstream rejection and network failures', async () => {
  for (const [key, value] of [['MAIL_GATEWAY_URL','https://mail.example/'], ['MAIL_GATEWAY_API_KEY','synthetic-only'], ['CONTACT_TO','recipient@example.com']]) {
    vi.stubEnv(key,''); const missing=response(); await handler(request(),missing);
    expect(missing.status).toHaveBeenCalledWith(503);
    vi.stubEnv(key,value);
  }
  for (const result of ['rejected','offline']) {
    vi.stubGlobal('fetch', vi.fn(async()=>{if(result==='offline')throw new Error('offline');return {ok:false};}));
    const res=response(); await handler(request(),res); expect(res.status).toHaveBeenCalledWith(502);
  }
});

it('sends trimmed bounded content through the configured gateway and preserves email acceptance', async () => {
  const fetch=vi.fn(async()=>({ok:true})); vi.stubGlobal('fetch',fetch);
  const res=response(); await handler(request({headers:{'x-forwarded-for':'fixture-string, proxy'}, body:{name:' Visitor ',email:'a@b.c',message:' Hello '}}),res);
  expect(res.status).toHaveBeenCalledWith(200);
  const [url, options]=fetch.mock.calls[0] as any;
  expect(url).toBe('https://mail.example/v1/mail/send');
  expect(JSON.parse(options.body)).toEqual({provider:'smtp',to:'recipient@example.com',subject:'[Web] Visitor',text:'Name: Visitor\nContact: a@b.c\n\nHello'});
  const local=response(); await handler(request({headers:{'x-forwarded-for':[]},socket:{}}),local);
  expect(local.status).toHaveBeenCalledWith(200);
});

it('keeps browser capabilities false during server-side evaluation', () => {
  expect(isBrowser).toBe(false); expect(isMobile).toBe(false);
  expect(canUseDOM).toBe(false); expect(isApple).toBe(false);
});
