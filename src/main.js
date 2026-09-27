import './styles.css';
import { analyzePgn } from './services/review.js';
import {
  backendConfigured, initBackend, currentUser, register, login, logout,
  saveReview, listReviews, updateReview, deleteReview, deleteCurrentProfile
} from './services/backend.js';
import { renderBoard } from './ui/board.js';

const $ = (id) => document.getElementById(id);
const state = { review: null, selectedMove: 0, orientation: 'w', history: [] };

const els = {
  setupBanner: $('setupBanner'), authStatus: $('authStatus'),
  loggedOutPanel: $('loggedOutPanel'), loggedInPanel: $('loggedInPanel'),
  currentUsername: $('currentUsername'), registerForm: $('registerForm'),
  loginForm: $('loginForm'), logoutBtn: $('logoutBtn'), deleteProfileBtn: $('deleteProfileBtn'), analysisForm: $('analysisForm'),
  pgnInput: $('pgnInput'), playerColor: $('playerColor'), currentElo: $('currentElo'),
  engineDepth: $('engineDepth'), analyzeBtn: $('analyzeBtn'), progress: $('analysisProgress'),
  progressText: $('progressText'), progressPercent: $('progressPercent'), progressBar: $('progressBar'),
  appMessage: $('appMessage'), reviewSection: $('reviewSection'), chessBoard: $('chessBoard'),
  positionTitle: $('positionTitle'), moveExplanation: $('moveExplanation'), prevMoveBtn: $('prevMoveBtn'),
  nextMoveBtn: $('nextMoveBtn'), flipBoardBtn: $('flipBoardBtn'), gameTitle: $('gameTitle'),
  saveReviewBtn: $('saveReviewBtn'), summaryStats: $('summaryStats'), summaryText: $('summaryText'),
  candidateHeading: $('candidateHeading'), candidateMoves: $('candidateMoves'), moveList: $('moveList'),
  historyList: $('historyList'), refreshHistoryBtn: $('refreshHistoryBtn')
};

function boot() {
  if (backendConfigured) initBackend();
  else {
    els.setupBanner.classList.remove('hidden');
    els.setupBanner.textContent = 'Back4App is not configured yet. PGN analysis still works, but account and saved-review features need the environment variables.';
  }
  els.registerForm.addEventListener('submit', onRegister);
  els.loginForm.addEventListener('submit', onLogin);
  els.logoutBtn.addEventListener('click', onLogout);
  els.deleteProfileBtn.addEventListener('click', onDeleteProfile);
  els.analysisForm.addEventListener('submit', onAnalyze);
  els.saveReviewBtn.addEventListener('click', onSaveReview);
  els.refreshHistoryBtn.addEventListener('click', refreshHistory);
  els.prevMoveBtn.addEventListener('click', () => selectMove(state.selectedMove - 1, true));
  els.nextMoveBtn.addEventListener('click', () => selectMove(state.selectedMove + 1, true));
  els.flipBoardBtn.addEventListener('click', () => {
    state.orientation = state.orientation === 'w' ? 'b' : 'w';
    renderSelectedMove();
  });
  updateAuthUi();
}

async function onRegister(event) {
  event.preventDefault();
  clearMessage();
  try {
    const username = $('registerUsername').value.trim();
    await register(username, $('registerPassword').value);
    showMessage(`Account created. Logged in as ${username}.`);
    event.target.reset();
    await updateAuthUi();
  } catch (error) { showMessage(error.message, true); }
}
async function onLogin(event) {
  event.preventDefault();
  clearMessage();
  try {
    const username = $('loginUsername').value.trim();
    await login(username, $('loginPassword').value);
    showMessage(`Logged in as ${username}.`);
    event.target.reset();
    await updateAuthUi();
  } catch (error) { showMessage(error.message, true); }
}
async function onLogout() {
  try {
    await logout();
    state.history = [];
    showMessage('Logged out.');
    await updateAuthUi();
  } catch (error) { showMessage(error.message, true); }
}
async function onDeleteProfile() {
  const user = currentUser();
  if (!user) return;

  const username = user.get('username');
  const firstCheck = confirm(
    `Delete the chess profile "${username}"? This will also permanently delete all saved game reviews for this account.`
  );
  if (!firstCheck) return;

  const typed = prompt('Type DELETE to confirm profile deletion:');
  if (typed !== 'DELETE') {
    showMessage('Profile deletion canceled.');
    return;
  }

  try {
    await deleteCurrentProfile();
    state.history = [];
    state.review = null;
    els.reviewSection.classList.add('hidden');
    showMessage('Chess profile and saved reviews deleted.');
    await updateAuthUi();
  } catch (error) {
    showMessage(error.message || 'The chess profile could not be deleted.', true);
  }
}
async function updateAuthUi() {
  const user = currentUser();
  const loggedIn = Boolean(user);
  els.loggedOutPanel.classList.toggle('hidden', loggedIn);
  els.loggedInPanel.classList.toggle('hidden', !loggedIn);
  els.currentUsername.textContent = loggedIn ? user.get('username') : '';
  els.authStatus.textContent = loggedIn ? `Signed in: ${user.get('username')}` : 'Not signed in';
  els.saveReviewBtn.disabled = !loggedIn;
  if (loggedIn) await refreshHistory();
  else els.historyList.innerHTML = '<p class="empty-state">Log in to view saved reviews.</p>';
}

async function onAnalyze(event) {
  event.preventDefault();
  clearMessage();
  setAnalyzing(true);
  try {
    const user = currentUser();
    const review = await analyzePgn({
      pgn: els.pgnInput.value,
      requestedColor: els.playerColor.value,
      username: user?.get('username') || '',
      currentElo: Number(els.currentElo.value),
      depth: Number(els.engineDepth.value),
      onProgress: updateProgress
    });
    state.review = review;
    state.orientation = review.playerColor;
    const first = review.moves.findIndex((move) => move.color === review.playerColor);
    state.selectedMove = Math.max(0, first);
    renderReview();
    showMessage('Game review finished. Click any move to inspect the position and Stockfish choices.');
    els.reviewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { showMessage(error.message || 'The game could not be analyzed.', true); }
  finally { setAnalyzing(false); }
}
function setAnalyzing(active) {
  els.analyzeBtn.disabled = active;
  els.analyzeBtn.textContent = active ? 'Analyzing…' : 'Review Game';
  els.progress.classList.toggle('hidden', !active);
  if (active) updateProgress(0, 1);
}
function updateProgress(done, total) {
  const percent = Math.round((done / total) * 100);
  els.progressText.textContent = done === 0 ? 'Loading Stockfish…' : `Analyzing position ${done} of ${total}`;
  els.progressPercent.textContent = `${percent}%`;
  els.progressBar.style.width = `${percent}%`;
}

function renderReview() {
  if (!state.review) return;
  const review = state.review;
  els.reviewSection.classList.remove('hidden');
  els.gameTitle.textContent = `${review.headers?.White || 'White'} vs ${review.headers?.Black || 'Black'}`;
  const stats = [
    ['Accuracy', `${review.summary.accuracy}%`],
    ['Avg. CP loss', review.summary.averageCpLoss],
    ['Current Elo', review.currentElo],
    ['Game estimate', review.summary.estimatedElo]
  ];
  els.summaryStats.innerHTML = stats.map(([label, value]) =>
    `<div class="stat"><span class="value">${escapeHtml(String(value))}</span><span class="label">${escapeHtml(label)}</span></div>`
  ).join('');
  const c = review.summary.counts || {};
  els.summaryText.innerHTML = `
    <p>${escapeHtml(review.summary.message)}</p>
    <p><strong>Your move labels:</strong> ${countText(c,'Brilliant')}, ${countText(c,'Best')}, ${countText(c,'Great')}, ${countText(c,'Excellent')}, ${countText(c,'Good')}, ${countText(c,'Inaccuracy')}, ${countText(c,'Mistake')}, ${countText(c,'Blunder')}.</p>
    <p class="empty-state">The performance Elo is a rough heuristic based only on this game's engine accuracy.</p>`;
  renderMoveList();
  renderSelectedMove();
}
function renderMoveList() {
  els.moveList.innerHTML = '';
  state.review.moves.forEach((move, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `move-row${index === state.selectedMove ? ' active' : ''}`;
    const prefix = move.color === 'w' ? `${move.moveNumber}.` : `${move.moveNumber}...`;
    button.innerHTML = `
      <span class="move-number">${prefix}</span>
      <span class="move-san">${escapeHtml(move.san)}</span>
      <span class="move-label ${move.classification.toLowerCase()}">${escapeHtml(move.classification)}</span>
      <span class="move-cpl">${move.centipawnLoss} CPL</span>`;
    button.addEventListener('click', () => selectMove(index, true));
    els.moveList.appendChild(button);
  });
}
function selectMove(index, withSound = false) {
  if (!state.review) return;
  const previous = state.selectedMove;
  state.selectedMove = Math.max(0, Math.min(index, state.review.moves.length - 1));
  renderMoveList();
  renderSelectedMove();
  if (withSound && state.selectedMove !== previous) playMoveSound(state.review.moves[state.selectedMove]);
}
function renderSelectedMove() {
  if (!state.review) return;
  const move = state.review.moves[state.selectedMove];
  renderBoard(els.chessBoard, move.afterFen, state.orientation, { from: move.from, to: move.to });
  const prefix = move.color === 'w' ? `${move.moveNumber}.` : `${move.moveNumber}...`;
  els.positionTitle.textContent = `${prefix}${move.san} — ${move.classification}`;
  els.moveExplanation.innerHTML = `<strong>${move.color === state.review.playerColor ? 'Your move' : 'Opponent move'}:</strong> ${escapeHtml(move.explanation)}<br><span class="empty-state">${move.rank ? `Stockfish rank: #${move.rank}` : 'Outside top five'} · ${move.centipawnLoss} centipawns lost</span>`;
  els.candidateHeading.textContent = `Before ${prefix}${move.san}, Stockfish preferred:`;
  els.candidateMoves.innerHTML = move.topMoves.length ? move.topMoves.map((candidate) => `
    <div class="candidate-row">
      <span class="candidate-rank">${candidate.rank}</span>
      <span class="candidate-move">${escapeHtml(candidate.san)}</span>
      <span class="candidate-score">${escapeHtml(candidate.score)}</span>
      <span class="candidate-pv">${escapeHtml(candidate.pvSan || candidate.uci)}</span>
    </div>`).join('') : '<p class="empty-state">No candidate moves are available for this terminal position.</p>';
  els.prevMoveBtn.disabled = state.selectedMove === 0;
  els.nextMoveBtn.disabled = state.selectedMove === state.review.moves.length - 1;
}

function playMoveSound(move) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const isCapture = move.san.includes('x');
    const isCheck = move.san.includes('+') || move.san.includes('#');

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(isCheck ? 720 : isCapture ? 300 : 430, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.13, context.currentTime + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (isCheck ? 0.12 : 0.07));

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + (isCheck ? 0.13 : 0.08));
    oscillator.onended = () => context.close();
  } catch {}
}

async function onSaveReview() {
  if (!state.review) return;
  if (!currentUser()) return showMessage('Log in before saving a review.', true);
  const proposed = prompt('Title for this saved review:', state.review.title);
  if (proposed === null) return;
  state.review.title = proposed.trim() || state.review.title;
  try {
    await saveReview(state.review);
    showMessage('Review saved to Back4App.');
    await refreshHistory();
  } catch (error) { showMessage(error.message, true); }
}
async function refreshHistory() {
  if (!currentUser()) return;
  try {
    state.history = await listReviews();
    renderHistory();
  } catch (error) { els.historyList.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`; }
}
function renderHistory() {
  if (!state.history.length) {
    els.historyList.innerHTML = '<p class="empty-state">No saved reviews yet. Analyze a PGN and save it here.</p>';
    return;
  }
  els.historyList.innerHTML = '';
  state.history.forEach((record) => {
    const item = document.createElement('article');
    item.className = 'history-item';
    const created = record.createdAt ? new Date(record.createdAt).toLocaleString() : '';
    item.innerHTML = `
      <div class="history-main">
        <h3>${escapeHtml(record.title || `${record.white} vs ${record.black}`)}</h3>
        <p>${escapeHtml(record.white || 'White')} vs ${escapeHtml(record.black || 'Black')} · ${escapeHtml(record.result || '*')} · ${record.accuracy ?? '—'}% accuracy · estimated ${record.estimatedElo ?? '—'} Elo</p>
        <p>${escapeHtml(created)}</p>
        ${record.notes ? `<p class="history-notes">${escapeHtml(record.notes)}</p>` : ''}
      </div>
      <div class="history-actions"><button class="small-btn load-btn">Load</button><button class="small-btn edit-btn">Edit</button><button class="small-btn danger delete-btn">Delete</button></div>`;
    item.querySelector('.load-btn').addEventListener('click', () => loadSavedReview(record));
    item.querySelector('.edit-btn').addEventListener('click', () => editSavedReview(record));
    item.querySelector('.delete-btn').addEventListener('click', () => removeSavedReview(record));
    els.historyList.appendChild(item);
  });
}
function loadSavedReview(record) {
  if (!record.analysis) return showMessage('This saved record does not contain the full move analysis.', true);
  state.review = record.analysis;
  state.review.title = record.title || state.review.title;
  state.review.notes = record.notes || '';
  state.orientation = state.review.playerColor || 'w';
  const first = state.review.moves.findIndex((move) => move.color === state.review.playerColor);
  state.selectedMove = Math.max(0, first);
  els.pgnInput.value = state.review.pgn || record.pgn || '';
  els.currentElo.value = state.review.currentElo || record.currentElo || 1000;
  els.playerColor.value = state.review.playerColor || 'auto';
  renderReview();
  showMessage('Saved review loaded.');
}
async function editSavedReview(record) {
  const title = prompt('Edit review title:', record.title || 'Chess game review');
  if (title === null) return;
  const notes = prompt('Edit notes:', record.notes || '');
  if (notes === null) return;
  try { await updateReview(record.id, { title, notes }); showMessage('Saved review updated.'); await refreshHistory(); }
  catch (error) { showMessage(error.message, true); }
}
async function removeSavedReview(record) {
  if (!confirm(`Delete "${record.title}"? This cannot be undone.`)) return;
  try { await deleteReview(record.id); showMessage('Saved review deleted.'); await refreshHistory(); }
  catch (error) { showMessage(error.message, true); }
}
function countText(counts, label) { return `${counts[label] || 0} ${label.toLowerCase()}`; }
function showMessage(text, error = false) {
  els.appMessage.textContent = text;
  els.appMessage.classList.remove('hidden','error');
  if (error) els.appMessage.classList.add('error');
}
function clearMessage() {
  els.appMessage.classList.add('hidden');
  els.appMessage.classList.remove('error');
  els.appMessage.textContent = '';
}
function escapeHtml(value) {
  return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}
boot();
