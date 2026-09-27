# KnightLens Specification

## Goal
Build a small web application that lets a chess player paste a PGN and receive a Stockfish-based game review without needing Chess.com game review.

## Required features
1. Register, log in, and log out using a chess username and password.
2. Paste a legal PGN and choose the side played by the user.
3. Enter the user's current Elo for comparison.
4. Analyze each position with Stockfish and request up to five candidate moves.
5. Label played moves with understandable engine-based categories.
6. Detect a possible brilliant move using a transparent tactical-sacrifice heuristic.
7. Show overall accuracy, average centipawn loss, current Elo, and a rough game-performance Elo estimate.
8. Save completed reviews to the backend.
9. List saved reviews for the logged-in user.
10. Update a saved review's title and notes.
11. Delete a saved review.
12. Load a saved review back into the review screen.
13. Deploy the finished application to a public URL.

## Acceptance criteria
- Invalid PGNs show an error and do not crash the page.
- Stockfish runs in a Web Worker and keeps the interface responsive.
- Saved reviews are protected with a user-only Parse ACL.
- The user's password is handled by Parse authentication and is never stored by this application.
- No Master Key or other private server credential is committed to GitHub.
- The app can be built with `npm run build`.
