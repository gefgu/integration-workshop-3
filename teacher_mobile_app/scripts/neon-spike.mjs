// Step-0 spike: Neon Auth sign-up/sign-in and a Data API read, using only fetch (works in Hermes too).
// Usage: node scripts/neon-spike.mjs <auth-base-url> <data-api-url> <email> <password>
const [authBase, restBase, email, password] = process.argv.slice(2);

async function call(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, headers: response.headers, body };
}

const json = (data, headers = {}) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers },
  body: JSON.stringify(data),
});

const signUp = await call(`${authBase}/sign-up/email`, json({ email, password, name: 'Spike' }));
console.log('sign-up', signUp.status, JSON.stringify(signUp.body).slice(0, 200));

const signIn = await call(`${authBase}/sign-in/email`, json({ email, password }));
console.log('sign-in', signIn.status, JSON.stringify(signIn.body).slice(0, 200));
const bearer = signIn.headers.get('set-auth-jwt') ?? signIn.headers.get('set-auth-token');
console.log('headers with token:', [...signIn.headers.keys()].filter((k) => /auth|token|jwt|cookie/i.test(k)));

const session = signIn.body?.token ?? bearer ?? '';
const cookie = (signIn.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
let token = await call(`${authBase}/token`, {
  headers: { Authorization: `Bearer ${session}`, Origin: 'http://localhost' },
});
console.log('token via bearer', token.status, JSON.stringify(token.body).slice(0, 120));
if (token.status !== 200) {
  token = await call(`${authBase}/token`, { headers: { Cookie: cookie, Origin: 'http://localhost' } });
  console.log('token via cookie', token.status, JSON.stringify(token.body).slice(0, 120));
}
const sessionCall = await call(`${authBase}/get-session`, { headers: { Authorization: `Bearer ${session}`, Origin: 'http://localhost' } });
console.log('get-session via bearer', sessionCall.status, sessionCall.headers.get('set-auth-jwt') ? 'has set-auth-jwt' : 'no jwt header');

const jwt = token.body?.token ?? signIn.headers.get('set-auth-jwt');
if (jwt) {
  const read = await call(`${restBase}/teachers?select=id,email`, { headers: { Authorization: `Bearer ${jwt}` } });
  console.log('data api read', read.status, JSON.stringify(read.body).slice(0, 300));
}

// Does the first Data API read after a brand-new sign-up see the teacher? Repeat to find out.
if (jwt) {
  for (let i = 1; i <= 4; i += 1) {
    const read = await call(`${restBase}/teachers?select=id,email`, { headers: { Authorization: `Bearer ${jwt}` } });
    console.log(`read #${i} (+${i - 1}s)`, read.status, JSON.stringify(read.body).slice(0, 120));
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
