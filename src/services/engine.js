export class StockfishEngine {
  constructor() {
    this.worker = null;
    this.ready = false;
    this.readyPromise = null;
    this.resolveReady = null;
    this.currentJob = null;
  }
  async init() {
    if (this.ready) return;
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      try {
        const base = import.meta.env.BASE_URL || '/';
        this.worker = new Worker(`${base}engine/stockfish-18-lite-single.js`);
        this.worker.onmessage = (event) => this.handleMessage(event.data);
        this.worker.onerror = reject;
        this.worker.postMessage('uci');
      } catch (error) { reject(error); }
    });
    return this.readyPromise;
  }
  handleMessage(raw) {
    const line = typeof raw === 'string' ? raw : String(raw?.data ?? raw ?? '');
    if (line === 'uciok') {
      this.worker.postMessage('setoption name MultiPV value 5');
      this.worker.postMessage('isready');
      return;
    }
    if (line === 'readyok' && !this.ready) {
      this.ready = true;
      this.resolveReady?.();
      return;
    }
    if (!this.currentJob) return;
    if (line.startsWith('info ')) {
      const parsed = parseInfoLine(line);
      if (parsed) {
        const existing = this.currentJob.lines.get(parsed.multiPv);
        if (!existing || parsed.depth >= existing.depth) this.currentJob.lines.set(parsed.multiPv, parsed);
      }
      return;
    }
    if (line.startsWith('bestmove')) {
      const job = this.currentJob;
      this.currentJob = null;
      const topMoves = [...job.lines.values()].sort((a,b) => a.multiPv - b.multiPv).slice(0, job.multiPv);
      job.resolve({ topMoves });
    }
  }
  async analyze(fen, { depth = 11, multiPv = 5 } = {}) {
    await this.init();
    if (this.currentJob) throw new Error('Stockfish is already analyzing a position.');
    return new Promise((resolve, reject) => {
      this.currentJob = { resolve, reject, lines: new Map(), multiPv };
      try {
        this.worker.postMessage(`setoption name MultiPV value ${multiPv}`);
        this.worker.postMessage(`position fen ${fen}`);
        this.worker.postMessage(`go depth ${depth}`);
      } catch (error) {
        this.currentJob = null;
        reject(error);
      }
    });
  }
  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.readyPromise = null;
  }
}
function parseInfoLine(line) {
  const depthMatch = line.match(/\bdepth\s+(\d+)/);
  const pvMatch = line.match(/\bpv\s+(.+)$/);
  const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
  if (!depthMatch || !pvMatch || !scoreMatch) return null;
  const multiPvMatch = line.match(/\bmultipv\s+(\d+)/);
  const scoreType = scoreMatch[1];
  const scoreValue = Number(scoreMatch[2]);
  return {
    depth: Number(depthMatch[1]),
    multiPv: multiPvMatch ? Number(multiPvMatch[1]) : 1,
    scoreType,
    scoreValue,
    scoreCp: scoreToCp(scoreType, scoreValue),
    displayScore: formatScore(scoreType, scoreValue),
    pv: pvMatch[1].trim().split(/\s+/),
    uci: pvMatch[1].trim().split(/\s+/)[0]
  };
}
export function scoreToCp(type, value) {
  if (type === 'cp') return value;
  const sign = value >= 0 ? 1 : -1;
  return sign * (100000 - Math.min(Math.abs(value), 99) * 1000);
}
export function formatScore(type, value) {
  if (type === 'mate') return `M${value}`;
  const pawns = value / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`;
}
