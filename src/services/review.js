import { Chess } from 'chess.js';
import { StockfishEngine } from './engine.js';

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

export async function analyzePgn({ pgn, requestedColor, username, currentElo, depth = 11, onProgress }) {
  const game = new Chess();
  try {
    game.loadPgn(pgn.trim());
  } catch (error) {
    throw new Error(`The PGN could not be read. ${error.message}`);
  }

  const history = game.history({ verbose: true });
  if (!history.length) throw new Error('The PGN does not contain any moves.');

  const headers = game.getHeaders();
  const playerColor = resolvePlayerColor(requestedColor, username, headers);
  const engine = new StockfishEngine();
  await engine.init();

  const positionFens = history.map((move) => move.before);
  positionFens.push(history[history.length - 1].after);

  const positionAnalyses = [];
  for (let i = 0; i < positionFens.length; i += 1) {
    const fen = positionFens[i];
    const terminal = terminalAnalysis(fen);
    let analysis;
    if (terminal) {
      analysis = terminal;
    } else {
      const multiPv = i === positionFens.length - 1 ? 1 : 5;
      analysis = await engine.analyze(fen, { depth, multiPv });
      analysis.topMoves = analysis.topMoves.map((line) => ({
        ...line,
        san: uciToSan(fen, line.uci),
        pvSan: pvToSan(fen, line.pv)
      }));
    }
    positionAnalyses.push(analysis);
    onProgress?.(i + 1, positionFens.length);
  }

  engine.terminate();

  const reviewedMoves = history.map((move, index) => {
    const before = positionAnalyses[index];
    const after = positionAnalyses[index + 1];
    const actualUci = `${move.from}${move.to}${move.promotion || ''}`;
    const topMoves = before.topMoves || [];
    const rankIndex = topMoves.findIndex((candidate) => candidate.uci === actualUci);
    const rank = rankIndex === -1 ? null : rankIndex + 1;
    const beforeBest = topMoves[0]?.scoreCp ?? 0;
    const afterOpponentScore = after.topMoves?.[0]?.scoreCp ?? after.scoreCp ?? 0;
    const playerScoreAfter = -afterOpponentScore;
    const sideToMoveAfter = move.after.split(' ')[1];
    const evaluationCp = sideToMoveAfter === 'w' ? afterOpponentScore : -afterOpponentScore;
    const rawLoss = Math.max(0, beforeBest - playerScoreAfter);
    const centipawnLoss = Math.min(1000, Math.round(rawLoss));
    const sacrificial = seemsSacrificial(move.before, move);
    const classification = classifyMove({ rank, centipawnLoss, sacrificial, playerScoreAfter, move });

    return {
      index,
      ply: index + 1,
      moveNumber: Math.floor(index / 2) + 1,
      color: move.color,
      san: move.san,
      from: move.from,
      to: move.to,
      uci: actualUci,
      beforeFen: move.before,
      afterFen: move.after,
      rank,
      centipawnLoss,
      evaluationCp,
      classification,
      explanation: explanationFor(classification, rank, centipawnLoss, sacrificial),
      topMoves: topMoves.map((candidate) => ({
        rank: candidate.multiPv,
        uci: candidate.uci,
        san: candidate.san,
        score: candidate.displayScore,
        scoreCp: candidate.scoreCp,
        pvSan: candidate.pvSan
      }))
    };
  });

  const playerMoves = reviewedMoves.filter((move) => move.color === playerColor);
  const summary = buildSummary(playerMoves, Number(currentElo));
  const white = headers.White || 'White';
  const black = headers.Black || 'Black';

  return {
    title: `${white} vs ${black}`,
    notes: '',
    pgn: pgn.trim(),
    headers,
    playerColor,
    currentElo: Number(currentElo),
    engineDepth: Number(depth),
    generatedAt: new Date().toISOString(),
    summary,
    moves: reviewedMoves
  };
}

function resolvePlayerColor(requestedColor, username, headers) {
  if (requestedColor === 'w' || requestedColor === 'b') return requestedColor;
  const normalized = (username || '').trim().toLowerCase();
  if (normalized && (headers.White || '').trim().toLowerCase() === normalized) return 'w';
  if (normalized && (headers.Black || '').trim().toLowerCase() === normalized) return 'b';
  throw new Error('I could not match your logged-in username to the PGN. Choose White or Black manually.');
}

function terminalAnalysis(fen) {
  const chess = new Chess(fen);
  if (!chess.isGameOver()) return null;
  if (chess.isCheckmate()) return { topMoves: [], scoreCp: -100000, terminal: 'checkmate' };
  return { topMoves: [], scoreCp: 0, terminal: 'draw' };
}

function uciToSan(fen, uci) {
  if (!uci || uci === '(none)') return '—';
  const chess = new Chess(fen);
  try {
    const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
    return move?.san || uci;
  } catch { return uci; }
}

function pvToSan(fen, pv = []) {
  const chess = new Chess(fen);
  const result = [];
  for (const uci of pv.slice(0, 6)) {
    try {
      const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
      if (!move) break;
      result.push(move.san);
    } catch { break; }
  }
  return result.join(' ');
}

function seemsSacrificial(fen, move) {
  const movingValue = PIECE_VALUES[move.piece] || 0;
  const capturedValue = PIECE_VALUES[move.captured] || 0;
  if (movingValue < 3 || movingValue - capturedValue < 2) return false;
  const chess = new Chess(fen);
  try {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    return chess.moves({ verbose: true }).some((reply) => reply.to === move.to && reply.captured === move.piece);
  } catch { return false; }
}

function classifyMove({ rank, centipawnLoss, sacrificial, playerScoreAfter, move }) {
  const deliveredMate = move.san.includes('#');
  if (rank === 1 && sacrificial && centipawnLoss <= 12 && playerScoreAfter > -80) return 'Brilliant';
  if (rank === 1 || deliveredMate) return 'Best';
  if (rank === 2 && centipawnLoss <= 12) return 'Great';
  if (centipawnLoss <= 30) return 'Excellent';
  if (centipawnLoss <= 80) return 'Good';
  if (centipawnLoss <= 150) return 'Inaccuracy';
  if (centipawnLoss <= 300) return 'Mistake';
  return 'Blunder';
}

function explanationFor(classification, rank, cpl, sacrificial) {
  const rankText = rank ? `It ranked #${rank} in Stockfish's top five.` : "It was outside Stockfish's top five choices.";
  switch (classification) {
    case 'Brilliant': return `A strong tactical sacrifice and Stockfish's first choice. The position stays sound after giving material. ${rankText}`;
    case 'Best': return `This matched Stockfish's first choice in the position. ${rankText}`;
    case 'Great': return `This was nearly equal to the engine's best move and lost only ${cpl} centipawns. ${rankText}`;
    case 'Excellent': return `A very accurate move with only ${cpl} centipawns of loss. ${rankText}`;
    case 'Good': return `A solid move, although the engine found a slightly stronger continuation. Centipawn loss: ${cpl}. ${rankText}`;
    case 'Inaccuracy': return `This gave up some of the position. Centipawn loss: ${cpl}. Compare it with the engine choices above.`;
    case 'Mistake': return `This changed the evaluation noticeably. Centipawn loss: ${cpl}. The top engine line shows the safer idea.`;
    case 'Blunder': return `This was a major evaluation drop of about ${cpl} centipawns. Review the best engine continuation for this position.`;
    default: return sacrificial ? 'Interesting tactical move.' : 'Engine review complete.';
  }
}

function buildSummary(playerMoves, currentElo) {
  const count = playerMoves.length || 1;
  const averageCpLoss = Math.round(playerMoves.reduce((sum, move) => sum + move.centipawnLoss, 0) / count);
  const moveAccuracy = playerMoves.map((move) => 100 * Math.exp(-move.centipawnLoss / 220));
  const accuracy = Number((moveAccuracy.reduce((sum, value) => sum + value, 0) / count).toFixed(1));
  const counts = playerMoves.reduce((acc, move) => {
    acc[move.classification] = (acc[move.classification] || 0) + 1;
    return acc;
  }, {});
  const mistakes = counts.Mistake || 0;
  const blunders = counts.Blunder || 0;
  const estimatedRaw = 500 + (accuracy - 50) * 35 - mistakes * 35 - blunders * 85;
  const estimatedElo = clamp(Math.round(estimatedRaw / 25) * 25, 400, 2800);
  const strongMoves = (counts.Brilliant || 0) + (counts.Best || 0) + (counts.Great || 0) + (counts.Excellent || 0);

  let message = `You played ${strongMoves} highly accurate moves out of ${playerMoves.length}. `;
  if (blunders === 0 && mistakes === 0) message += 'There were no moves classified as mistakes or blunders.';
  else message += `The review found ${mistakes} mistake${mistakes === 1 ? '' : 's'} and ${blunders} blunder${blunders === 1 ? '' : 's'}.`;

  return { accuracy, averageCpLoss, estimatedElo, currentElo, counts, strongMoves, playerMoveCount: playerMoves.length, message };
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
