import Parse from 'parse/dist/parse.min.js';

const APP_ID = import.meta.env.VITE_PARSE_APP_ID?.trim();
const JS_KEY = import.meta.env.VITE_PARSE_JS_KEY?.trim();
const SERVER_URL = import.meta.env.VITE_PARSE_SERVER_URL?.trim() || 'https://parseapi.back4app.com/';

export const backendConfigured = Boolean(APP_ID && JS_KEY && !APP_ID.includes('YOUR_') && !JS_KEY.includes('YOUR_'));
let initialized = false;

export function initBackend() {
  if (!backendConfigured || initialized) return;
  Parse.initialize(APP_ID, JS_KEY);
  Parse.serverURL = SERVER_URL;
  initialized = true;
}
export function currentUser() {
  if (!backendConfigured) return null;
  initBackend();
  return Parse.User.current();
}
export async function register(username, password) {
  ensureConfigured();
  const user = new Parse.User();
  user.set('username', username.trim());
  user.set('password', password);
  await user.signUp();
  return user;
}
export async function login(username, password) {
  ensureConfigured();
  return Parse.User.logIn(username.trim(), password);
}
export async function logout() {
  ensureConfigured();
  await Parse.User.logOut();
}
export async function saveReview(review) {
  ensureConfigured();
  const user = requireUser();
  const Review = Parse.Object.extend('GameReview');
  const object = new Review();
  object.set('owner', user);
  object.set('username', user.get('username'));
  object.set('title', review.title);
  object.set('white', review.headers?.White || 'White');
  object.set('black', review.headers?.Black || 'Black');
  object.set('result', review.headers?.Result || '*');
  object.set('playerColor', review.playerColor);
  object.set('currentElo', Number(review.currentElo));
  object.set('estimatedElo', Number(review.summary.estimatedElo));
  object.set('accuracy', Number(review.summary.accuracy));
  object.set('pgn', review.pgn);
  object.set('notes', review.notes || '');
  object.set('analysisJson', JSON.stringify(review));
  const acl = new Parse.ACL();
  acl.setReadAccess(user, true);
  acl.setWriteAccess(user, true);
  object.setACL(acl);
  return object.save();
}
export async function listReviews() {
  ensureConfigured();
  const user = requireUser();
  const Review = Parse.Object.extend('GameReview');
  const query = new Parse.Query(Review);
  query.equalTo('owner', user);
  query.descending('createdAt');
  query.limit(50);
  const objects = await query.find();
  return objects.map(toReviewRecord);
}
export async function updateReview(id, { title, notes }) {
  ensureConfigured();
  const user = requireUser();
  const Review = Parse.Object.extend('GameReview');
  const object = await new Parse.Query(Review).get(id);
  verifyOwner(object, user);
  object.set('title', title.trim() || object.get('title'));
  object.set('notes', notes ?? '');
  const raw = object.get('analysisJson');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      parsed.title = object.get('title');
      parsed.notes = object.get('notes');
      object.set('analysisJson', JSON.stringify(parsed));
    } catch {}
  }
  return object.save();
}
export async function deleteReview(id) {
  ensureConfigured();
  const user = requireUser();
  const Review = Parse.Object.extend('GameReview');
  const object = await new Parse.Query(Review).get(id);
  verifyOwner(object, user);
  return object.destroy();
}
function toReviewRecord(object) {
  let analysis = null;
  try { analysis = JSON.parse(object.get('analysisJson') || 'null'); } catch {}
  return {
    id: object.id,
    title: object.get('title'),
    notes: object.get('notes') || '',
    white: object.get('white'),
    black: object.get('black'),
    result: object.get('result'),
    currentElo: object.get('currentElo'),
    estimatedElo: object.get('estimatedElo'),
    accuracy: object.get('accuracy'),
    pgn: object.get('pgn'),
    analysis,
    createdAt: object.createdAt
  };
}
function ensureConfigured() {
  if (!backendConfigured) throw new Error('Back4App is not configured yet. Add the VITE_PARSE_APP_ID and VITE_PARSE_JS_KEY environment variables.');
  initBackend();
}
function requireUser() {
  const user = Parse.User.current();
  if (!user) throw new Error('You must be logged in to change saved review data.');
  return user;
}
function verifyOwner(object, user) {
  const owner = object.get('owner');
  if (!owner || owner.id !== user.id) throw new Error('You do not have permission to modify this review.');
}
