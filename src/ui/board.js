import { Chess } from 'chess.js';

const PIECE_NAMES = { p: 'P', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };
const PIECE_BASE = 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/chessnut';
const BISHOP_BASE = 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett';

export function renderBoard(container, fen, orientation = 'w', highlight = null) {
  const chess = new Chess(fen);
  const board = chess.board();
  const ranks = orientation === 'w' ? [...Array(8).keys()] : [...Array(8).keys()].reverse();
  const files = orientation === 'w' ? [...Array(8).keys()] : [...Array(8).keys()].reverse();
  const fileNames = 'abcdefgh';
  container.innerHTML = '';

  ranks.forEach((rankIndex, displayRankIndex) => {
    files.forEach((fileIndex, displayFileIndex) => {
      const squareName = `${fileNames[fileIndex]}${8 - rankIndex}`;
      const piece = board[rankIndex][fileIndex];
      const square = document.createElement('div');
      square.className = `square ${(rankIndex + fileIndex) % 2 === 0 ? 'light' : 'dark'}`;

      if (highlight?.from === squareName) square.classList.add('last-from');
      if (highlight?.to === squareName) square.classList.add('last-to');

      if (piece) {
        const img = document.createElement('img');
        img.className = 'piece-image';
        img.alt = `${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}`;
        img.draggable = false;
        const pieceBase = piece.type === 'b' ? BISHOP_BASE : PIECE_BASE;
        img.src = `${pieceBase}/${piece.color}${PIECE_NAMES[piece.type]}.svg`;
        square.appendChild(img);
      }

      if (displayRankIndex === 7) {
        const file = document.createElement('span');
        file.className = 'coord file';
        file.textContent = fileNames[fileIndex];
        square.appendChild(file);
      }

      if (displayFileIndex === 0) {
        const rank = document.createElement('span');
        rank.className = 'coord rank';
        rank.textContent = 8 - rankIndex;
        square.appendChild(rank);
      }

      container.appendChild(square);
    });
  });
}
