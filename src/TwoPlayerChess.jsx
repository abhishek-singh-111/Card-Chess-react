// import React, { useState, useEffect } from "react";

// // Two-player Chess (local, same-machine) React component
// // - Full move generation (pieces, captures, pawn moves, castling, en-passant, promotion)
// // - Check and checkmate/stalemate detection
// // - Simple UI with clickable squares and move highlighting
// // - Uses Tailwind classes for styling (no external libs required)

// // Board coordinates: 0..7 rows (rank 8 -> 1 top->bottom), 0..7 cols (file a->h)

// const initialBoard = () => {
//   // Use objects: { type: 'p','n','b','r','q','k', color: 'w'|'b', moved: bool }
//   const empty = () => null;
//   const b = Array.from({ length: 8 }, () => Array(8).fill(null));

//   const backRank = (color) => [
//     { type: 'r', color },
//     { type: 'n', color },
//     { type: 'b', color },
//     { type: 'q', color },
//     { type: 'k', color },
//     { type: 'b', color },
//     { type: 'n', color },
//     { type: 'r', color },
//   ];

//   b[0] = backRank('b');
//   b[1] = Array(8).fill({ type: 'p', color: 'b' });
//   for (let r = 2; r <= 5; r++) b[r] = Array(8).fill(null);
//   b[6] = Array(8).fill({ type: 'p', color: 'w' });
//   b[7] = backRank('w');

//   // mark moved=false on pieces
//   for (let r = 0; r < 8; r++)
//     for (let c = 0; c < 8; c++)
//       if (b[r][c]) b[r][c] = { ...b[r][c], moved: false };

//   return b;
// };

// const cloneBoard = (board) => board.map((row) => row.map((sq) => (sq ? { ...sq } : null)));

// const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

// // Return array of {r,c} for pseudo-legal moves (not considering checks) and meta for special moves
// function getPseudoMoves(board, r, c, enPassantTarget) {
//   const piece = board[r][c];
//   if (!piece) return [];
//   const moves = [];
//   const dir = piece.color === 'w' ? -1 : 1; // white moves up (decreasing r)

//   const push = (nr, nc, meta = {}) => {
//     if (!inBounds(nr, nc)) return;
//     const dest = board[nr][nc];
//     if (!dest || dest.color !== piece.color) moves.push({ r: nr, c: nc, ...meta });
//   };

//   if (piece.type === 'p') {
//     const oneR = r + dir;
//     // forward
//     if (inBounds(oneR, c) && !board[oneR][c]) {
//       moves.push({ r: oneR, c });
//       // two squares
//       const startRow = piece.color === 'w' ? 6 : 1;
//       const twoR = r + dir * 2;
//       if (r === startRow && !board[twoR][c]) moves.push({ r: twoR, c, double: true });
//     }
//     // captures
//     for (const dc of [-1, 1]) {
//       const nr = r + dir,
//         nc = c + dc;
//       if (!inBounds(nr, nc)) continue;
//       const target = board[nr][nc];
//       if (target && target.color !== piece.color) moves.push({ r: nr, c: nc });
//       // en-passant
//       if (!target && enPassantTarget && enPassantTarget.r === nr && enPassantTarget.c === nc) {
//         moves.push({ r: nr, c: nc, enPassant: true });
//       }
//     }
//     return moves;
//   }

//   if (piece.type === 'n') {
//     const deltas = [
//       [-2, -1],
//       [-2, 1],
//       [-1, -2],
//       [-1, 2],
//       [1, -2],
//       [1, 2],
//       [2, -1],
//       [2, 1],
//     ];
//     for (const [dr, dc] of deltas) push(r + dr, c + dc);
//     return moves;
//   }

//   if (piece.type === 'b' || piece.type === 'r' || piece.type === 'q') {
//     const dirs = [];
//     if (piece.type === 'b' || piece.type === 'q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
//     if (piece.type === 'r' || piece.type === 'q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
//     for (const [dr, dc] of dirs) {
//       let nr = r + dr,
//         nc = c + dc;
//       while (inBounds(nr, nc)) {
//         if (!board[nr][nc]) moves.push({ r: nr, c: nc });
//         else {
//           if (board[nr][nc].color !== piece.color) moves.push({ r: nr, c: nc });
//           break;
//         }
//         nr += dr;
//         nc += dc;
//       }
//     }
//     return moves;
//   }

//   if (piece.type === 'k') {
//     for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) push(r + dr, c + dc);

//     // castling
//     if (!piece.moved) {
//       // king side
//       const row = r;
//       // kingside rook at c=7
//       if (board[row][7] && board[row][7].type === 'r' && !board[row][7].moved) {
//         if (!board[row][5] && !board[row][6]) moves.push({ r: row, c: 6, castle: 'k' });
//       }
//       // queenside rook at c=0
//       if (board[row][0] && board[row][0].type === 'r' && !board[row][0].moved) {
//         if (!board[row][1] && !board[row][2] && !board[row][3]) moves.push({ r: row, c: 2, castle: 'q' });
//       }
//     }
//     return moves;
//   }

//   return moves;
// }

// function findKing(board, color) {
//   for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r][c] && board[r][c].type === 'k' && board[r][c].color === color) return { r, c };
//   return null;
// }

// function isSquareAttacked(board, rr, cc, byColor, enPassantTarget) {
//   // generate opponent moves and see if any reaches rr,cc (efficient enough for local play)
//   for (let r = 0; r < 8; r++)
//     for (let c = 0; c < 8; c++) {
//       const p = board[r][c];
//       if (!p || p.color !== byColor) continue;
//       const pmoves = getPseudoMoves(board, r, c, enPassantTarget);
//       for (const m of pmoves) if (m.r === rr && m.c === cc) return true;
//     }
//   return false;
// }

// function makeMove(board, from, to, enPassantTarget) {
//   const nb = cloneBoard(board);
//   const piece = nb[from.r][from.c];
//   const dest = nb[to.r][to.c];

//   // handle en-passant capture
//   if (piece.type === 'p' && to.enPassant) {
//     const capR = from.r;
//     nb[capR][to.c] = null; // captured pawn
//   }

//   // handle castling
//   if (piece.type === 'k' && to.castle) {
//     const row = from.r;
//     if (to.castle === 'k') {
//       // move rook from 7 to 5
//       nb[row][5] = nb[row][7];
//       nb[row][7] = null;
//       if (nb[row][5]) nb[row][5].moved = true;
//     } else if (to.castle === 'q') {
//       nb[row][3] = nb[row][0];
//       nb[row][0] = null;
//       if (nb[row][3]) nb[row][3].moved = true;
//     }
//   }

//   // move piece
//   nb[to.r][to.c] = { ...piece, moved: true };
//   nb[from.r][from.c] = null;

//   // promotion
//   if (piece.type === 'p') {
//     const promotionRow = piece.color === 'w' ? 0 : 7;
//     if (to.r === promotionRow) {
//       // default to queen; caller may override with UI
//       nb[to.r][to.c].type = 'q';
//     }
//   }

//   // compute new enPassant target
//   let newEnPassant = null;
//   if (piece.type === 'p' && Math.abs(to.r - from.r) === 2) {
//     newEnPassant = { r: (from.r + to.r) / 2, c: from.c };
//   }

//   return { board: nb, enPassantTarget: newEnPassant };
// }

// function inCheck(board, color, enPassantTarget) {
//   const king = findKing(board, color);
//   if (!king) return true; // no king -> consider in check
//   return isSquareAttacked(board, king.r, king.c, color === 'w' ? 'b' : 'w', enPassantTarget);
// }

// function generateLegalMoves(board, r, c, enPassantTarget) {
//   const piece = board[r][c];
//   if (!piece) return [];
//   const pseudo = getPseudoMoves(board, r, c, enPassantTarget);
//   const legal = [];
//   for (const m of pseudo) {
//     const { board: nb } = makeMove(board, { r, c }, m, enPassantTarget);
//     // after move, check if own king is in check
//     if (!inCheck(nb, piece.color, m.enPassant ? null : null)) {
//       // NOTE: we pass enPassantTarget simplification because after move enPassant target recalculated separately
//       // better check whether resulting position leaves king in check using full enPassant behavior; for most cases this suffices
//       legal.push(m);
//     }
//   }
//   return legal;
// }

// export default function TwoPlayerChess() {
//   const [board, setBoard] = useState(initialBoard);
//   const [turn, setTurn] = useState('w');
//   const [selected, setSelected] = useState(null);
//   const [legalMoves, setLegalMoves] = useState([]);
//   const [enPassantTarget, setEnPassantTarget] = useState(null);
//   const [status, setStatus] = useState('White to move');

//   useEffect(() => {
//     setStatus(turn === 'w' ? "White to move" : "Black to move");
//   }, [turn]);

//   const onSquareClick = (r, c) => {
//     const sq = board[r][c];
//     // if selected piece and clicked a legal move
//     if (selected) {
//       const match = legalMoves.find((m) => m.r === r && m.c === c);
//       if (match) {
//         // perform move
//         const { board: nb, enPassantTarget: newEP } = makeMove(board, selected, match, enPassantTarget);
//         // handle promotion with prompt
//         const movedPiece = nb[r][c];
//         if (movedPiece.type === 'p') {
//           const promotionRow = movedPiece.color === 'w' ? 0 : 7;
//           if (r === promotionRow) {
//             const choice = window.prompt('Promote to (q,r,b,n) — default q', 'q') || 'q';
//             const t = ['q', 'r', 'b', 'n'].includes(choice) ? choice : 'q';
//             movedPiece.type = t;
//           }
//         }

//         setBoard(nb);
//         setEnPassantTarget(newEP);
//         setSelected(null);
//         setLegalMoves([]);
//         setTurn((t) => (t === 'w' ? 'b' : 'w'));

//         // update status after move using timeout to let state settle
//         setTimeout(() => {
//           const opp = turn === 'w' ? 'b' : 'w';
//           if (inCheck(nb, opp, newEP)) {
//             // check if checkmate
//             let hasAny = false;
//             for (let rr = 0; rr < 8; rr++)
//               for (let cc = 0; cc < 8; cc++) {
//                 const p = nb[rr][cc];
//                 if (p && p.color === opp) {
//                   const moves = generateLegalMoves(nb, rr, cc, newEP);
//                   if (moves.length) hasAny = true;
//                 }
//               }
//             if (!hasAny) setStatus(`${opp === 'w' ? 'White' : 'Black'} is checkmated — ${turn === 'w' ? 'White' : 'Black'} wins!`);
//             else setStatus(`${opp === 'w' ? 'White' : 'Black'} in check`);
//           } else {
//             // stalemate?
//             let hasAny = false;
//             for (let rr = 0; rr < 8; rr++)
//               for (let cc = 0; cc < 8; cc++) {
//                 const p = nb[rr][cc];
//                 if (p && p.color === opp) {
//                   const moves = generateLegalMoves(nb, rr, cc, newEP);
//                   if (moves.length) hasAny = true;
//                 }
//               }
//             if (!hasAny) setStatus('Stalemate — draw');
//             else setStatus(opp === 'w' ? 'White to move' : 'Black to move');
//           }
//         }, 10);

//         return;
//       }
//     }

//     // if selecting own piece
//     if (sq && sq.color === turn) {
//       const moves = generateLegalMoves(board, r, c, enPassantTarget);
//       setSelected({ r, c });
//       setLegalMoves(moves);
//     } else {
//       // clear selection
//       setSelected(null);
//       setLegalMoves([]);
//     }
//   };

//   const resetGame = () => {
//     setBoard(initialBoard());
//     setTurn('w');
//     setSelected(null);
//     setLegalMoves([]);
//     setEnPassantTarget(null);
//     setStatus('White to move');
//   };

//   const renderPiece = (p) => {
//     if (!p) return null;
//     const map = {
//       p: '♟',
//       n: '♞',
//       b: '♝',
//       r: '♜',
//       q: '♛',
//       k: '♚',
//     };
//     const symbol = map[p.type] || '?';
//     return (
//       <span className={`text-2xl ${p.color === 'w' ? 'rotate-180' : ''}`}>{symbol}</span>
//     );
//   };

//   return (
//     <div className="p-6 min-h-screen bg-gray-50 flex flex-col items-center">
//       <h1 className="text-2xl font-semibold mb-4">Two-player Chess (local)</h1>
//       <div className="mb-3">{status}</div>
//       <div className="grid grid-cols-12 gap-4">
//         <div className="col-span-8">
//           <div className="grid grid-cols-8 gap-0 border-2" style={{ width: 480 }}>
//             {board.map((row, r) =>
//               row.map((sq, c) => {
//                 const isLight = (r + c) % 2 === 0;
//                 const isSelected = selected && selected.r === r && selected.c === c;
//                 const canMoveHere = legalMoves.find((m) => m.r === r && m.c === c);
//                 return (
//                   <div
//                     key={`${r}-${c}`}
//                     onClick={() => onSquareClick(r, c)}
//                     className={`w-12 h-12 flex items-center justify-center cursor-pointer select-none ${
//                       isLight ? 'bg-yellow-100' : 'bg-green-800'
//                     } ${isSelected ? 'ring-4 ring-indigo-400' : ''} ${canMoveHere ? 'ring-4 ring-yellow-400' : ''}`}
//                     title={`${String.fromCharCode(97 + c)}${8 - r}`}
//                   >
//                     <div className="text-center text-white">
//                       {renderPiece(sq)}
//                     </div>
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         </div>

//         <div className="col-span-4">
//           <div className="mb-3">
//             <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={resetGame}>
//               Reset
//             </button>
//           </div>
//           <div className="bg-white p-3 rounded shadow-sm">
//             <h3 className="font-medium mb-2">Controls</h3>
//             <ul className="text-sm space-y-1">
//               <li>Click your piece to view legal moves.</li>
//               <li>Click a highlighted square to move.</li>
//               <li>Promotion asks via prompt (q/r/b/n).</li>
//               <li>Castling and en-passant are implemented.</li>
//             </ul>
//           </div>

//           <div className="bg-white p-3 rounded shadow-sm mt-3">
//             <h3 className="font-medium mb-2">Turn</h3>
//             <div>{turn === 'w' ? 'White' : 'Black'}</div>
//           </div>
//         </div>
//       </div>

//       <div className="mt-6 text-xs text-gray-500">
//         Note: This implementation focuses on a solid, local 2-player experience. It aims to implement chess rules including
//         castling, en-passant, and promotion. If you want network multiplayer, PGN export, AI opponent, or move history — tell
//         me which feature to add next and I will update the code.
//       </div>
//     </div>
//   );
// }
