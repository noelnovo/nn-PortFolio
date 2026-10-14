import type {NextApiRequest, NextApiResponse} from 'next';

/**
 * Contact form endpoint. Sends the message through the shared DownOps
 * mail-gateway (the visitor never has to open their mail client). The gateway
 * routes the sender (noreply@noelnovo.dev) by this project's API key, and the
 * recipient comes from CONTACT_TO. All three values are injected from Vault.
 */
type Body = {name?: string; message?: string};

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({error: 'Method not allowed'});
    return;
  }

  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'local';
  if (rateLimited(ip)) {
    res.status(429).json({error: 'Too many requests'});
    return;
  }

  const {name, message} = (req.body ?? {}) as Body;
  const from = clean(name, 80);
  const body = clean(message, 4000);
  if (!from || !body) {
    res.status(400).json({error: 'Missing fields'});
    return;
  }

  const base = (process.env.MAIL_GATEWAY_URL || '').replace(/\/$/, '');
  const key = process.env.MAIL_GATEWAY_API_KEY || '';
  const to = process.env.CONTACT_TO || '';
  if (!base || !key || !to) {
    res.status(503).json({error: 'Mail is not configured'});
    return;
  }

  const text = [`Name: ${from}`, '', body].join('\n');
  try {
    const response = await fetch(`${base}/v1/mail/send`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-Api-Key': key},
      body: JSON.stringify({provider: 'smtp', to, subject: `[Web] ${from}`, text}),
    });
    if (!response.ok) {
      res.status(502).json({error: 'Could not send the message'});
      return;
    }
    res.status(200).json({ok: true});
  } catch {
    res.status(502).json({error: 'Could not send the message'});
  }
}
