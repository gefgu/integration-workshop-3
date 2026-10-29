// Verifies the phone's Data API access on a Neon branch: row isolation, hidden columns, bench token, event sync.
// Usage: node scripts/neon-rls-check.mjs <auth-base-url> <data-api-url> <email> <password> <foreign-student-id>
const [authBase, restBase, email, password, foreignStudent] = process.argv.slice(2);
const origin = { Origin: 'http://localhost' };

const signIn = await fetch(`${authBase}/sign-in/email`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...origin },
  body: JSON.stringify({ email, password }),
});
const cookie = signIn.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const { token: jwt } = await (await fetch(`${authBase}/token`, { headers: { Cookie: cookie, ...origin } })).json();

async function rest(path, init = {}) {
  const response = await fetch(`${restBase}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', ...init.headers },
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}
const rpc = (name, args) => rest(`/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });
const show = (label, r) => console.log(label.padEnd(34), r.status, JSON.stringify(r.body).slice(0, 220));

show('teachers (own row only)', await rest('/teachers?select=id,email'));
show('teachers.password_hash (denied)', await rest('/teachers?select=password_hash'));
show('classes (own only)', await rest('/school_classes?select=id,name,teacher_id'));
const students = await rest('/students?select=id,name,nfc_code');
show('students (own only)', students);
show('progress_events (denied)', await rest('/progress_events?select=event_id'));
show('direct insert (denied)', await rest('/progress_events', { method: 'POST', body: JSON.stringify({ event_id: 'x'.repeat(10) }) }));

const session = await rpc('bench_session', {});
show('bench_session', session);
console.log('BENCH_TOKEN=' + session.body?.token);

const own = students.body?.[0];
const at = new Date().toISOString();
const event = (id, student, nfc) => ({ event_id: id, student_id: student, nfc_code: nfc, kind: 'step_done', seq: 1, at, step_idx: 0 });
const batch = [event('evt-own-0001', own.id, own.nfc_code), event('evt-foreign-1', Number(foreignStudent), 'NFC-OTHER'), { ...event('evt-bad-kind', own.id, 'n'), kind: 'nope' }];
show('sync (ack, reject, reject)', await rpc('sync_bench_events', { bench_id: 'bench-1', events: batch }));
show('sync again (dedup)', await rpc('sync_bench_events', { bench_id: 'bench-1', events: batch.slice(0, 1) }));

const modules = await rest('/modules?select=id,title');
show('modules (own only)', modules);
const pkg = await rpc('bench_package', { p_module_id: modules.body?.[0]?.id, p_class_id: 1 });
console.log('bench_package'.padEnd(34), pkg.status, pkg.body && pkg.body.format !== undefined
  ? JSON.stringify({ format: pkg.body.format, version_id: pkg.body.version_id, teacher: pkg.body.teacher, class: pkg.body.class,
      module: pkg.body.module, lessons: pkg.body.lessons.length, students: pkg.body.students, created_at: pkg.body.created_at })
  : JSON.stringify(pkg.body));
show('bench_package foreign class (404)', await rpc('bench_package', { p_module_id: modules.body?.[0]?.id, p_class_id: 2 }));
