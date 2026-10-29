// Runs the real NeonApi (the phone's code) against a Neon branch: sign up, read, bench session, package, sync.
// Usage: node --import tsx scripts/neon-live-check.mts <auth-url> <rest-url> <email> <password> <name>
// The e-mail must already exist in `teachers`. Re-running with an existing account signs in instead.
import { ApiError, type KeyValueStore } from '../src/lib/api.ts';
import { NeonApi } from '../src/lib/neonApi.ts';

const [authUrl, restUrl, email, password, name] = process.argv.slice(2);

const data = new Map<string, string>();
const store: KeyValueStore = {
  getItem: async (key) => data.get(key) ?? null,
  setItem: async (key, value) => void data.set(key, value),
  removeItem: async (key) => void data.delete(key),
};

const api = new NeonApi(store, { authUrl, restUrl });
let teacher;
try {
  teacher = await api.signUp(email, password, name);
  console.log('signUp ->', teacher);
} catch (error) {
  if (!(error instanceof ApiError) || !/Já existe/.test(error.message)) throw error;
  teacher = await api.login(email, password);
  console.log('login ->', teacher);
}

const classes = await api.classes();
console.log('classes', JSON.stringify(classes));
const detail = await api.classDetail(classes[0].id);
console.log('classDetail', detail.students.length, 'students,', detail.module_ids.length, 'modules');
const modules = await api.modules();
console.log('modules', JSON.stringify(modules.map((m) => ({ id: m.id, lessons: m.lesson_ids.length, classes: m.class_ids }))));
const session = await api.benchSession();
console.log('benchSession token', session.token.slice(0, 24) + '…', 'expires', session.expires_at);
if (modules[0] && classes[0]) {
  const pkg = await api.benchPackage(modules[0].id, classes[0].id);
  console.log('benchPackage', pkg.version_id, pkg.lessons.length, 'lessons,', pkg.students.length, 'students');
}
await api.logout();
console.log('after logout token =', api.token, 'stored keys =', [...data.keys()]);
