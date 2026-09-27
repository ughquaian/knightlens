# KnightLens

KnightLens is a small web application for reviewing chess games from PGN text. A player pastes a PGN, chooses the side they played, and KnightLens runs Stockfish in the browser to review the game move by move. It shows move labels, centipawn loss, Stockfish's top five choices for each position, an accuracy score, and a rough performance Elo estimate.

The project was built as an AI-assisted software development practice assignment. The goal was to use AI development tools to produce a functional full-stack application with authentication, a database, CRUD operations, version control, and deployment.

## Live Application

**Deployed app:** https://knightlens.netlify.app

**Demo video:** https://youtu.be/WMZBka5JnY4

## Main Features

- Register and log in with a chess username and password
- Paste and validate PGN game text
- Auto-detect the player's color when the PGN username matches the logged-in username
- Run Stockfish 18 locally in a Web Worker
- Show Stockfish's top five candidate moves for each reviewed position
- Label moves as Brilliant, Best, Great, Excellent, Good, Inaccuracy, Mistake, or Blunder
- Calculate average centipawn loss and a game accuracy score
- Compare the player's entered Elo with a rough game-performance Elo estimate
- Save completed reviews to Back4App
- Load previously saved reviews
- Update the title and notes of a saved review
- Delete saved reviews

The **Brilliant** label and **performance Elo** are transparent heuristics created for this project. They are not Chess.com formulas and should not be treated as official ratings.

## Technologies Used

- HTML/CSS/Vanilla JavaScript
- Vite
- chess.js for PGN parsing and chess position handling
- Stockfish 18 (lite single-threaded browser build) for engine analysis
- Back4App / Parse Server for the database and user authentication
- Git and GitHub for version control
- GitHub Actions for a basic build check
- Netlify for deployment

## Project Structure

```text
knightlens/
├── .github/workflows/ci.yml
├── scripts/copy-engine.mjs
├── src/
│   ├── services/
│   │   ├── backend.js
│   │   ├── engine.js
│   │   └── review.js
│   ├── ui/board.js
│   ├── main.js
│   └── styles.css
├── .env.example
├── AGENTS.md
├── SPEC.md
├── THIRD_PARTY_NOTICES.md
├── index.html
├── netlify.toml
└── package.json
```

## Database Design

Back4App automatically provides the `_User` class for authentication. KnightLens also creates a `GameReview` class when the first review is saved.

### `_User`

- `username` - chess username used to sign in
- `password` - handled and hashed by Parse/Back4App, never stored directly by KnightLens

### `GameReview`

- `owner` - pointer to the authenticated `_User`
- `username` - username saved for easier inspection
- `title` - editable review title
- `white` / `black` - PGN player names
- `result` - PGN result
- `playerColor` - side reviewed for the user
- `currentElo` - rating entered before analysis
- `estimatedElo` - rough game-performance estimate
- `accuracy` - calculated game accuracy
- `pgn` - original PGN text
- `notes` - editable user notes
- `analysisJson` - saved move-by-move review data

Each saved review gets a Parse ACL that only gives its owner read and write access.

## CRUD Operations

- **Create:** save a completed game review
- **Read:** list and load the logged-in user's saved reviews
- **Update:** edit a saved review's title and notes
- **Delete:** remove a saved review

## Local Setup

1. Install Node.js.
2. Clone this repository.
3. Install dependencies:

```bash
npm install
```

4. Create a free Back4App application.
5. In the Back4App dashboard, find the **Application ID** and **JavaScript Key**.
6. Copy `.env.example` to `.env` and fill in:

```env
VITE_PARSE_APP_ID=your_application_id
VITE_PARSE_JS_KEY=your_javascript_key
VITE_PARSE_SERVER_URL=https://parseapi.back4app.com/
```

Do not put a Back4App Master Key in the project.

7. Start the development server:

```bash
npm run dev
```

The predev/build script copies the Stockfish JavaScript and WASM files from the installed npm package into `public/engine`.

## Production Build

```bash
npm run build
```

The finished static site is written to the `dist` folder.

## Netlify Deployment

1. Create a Netlify account and choose **Add new site > Import an existing project**.
2. Connect this public GitHub repository.
3. Netlify should read `netlify.toml` automatically:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. In **Site configuration > Environment variables**, add:
   - `VITE_PARSE_APP_ID`
   - `VITE_PARSE_JS_KEY`
   - `VITE_PARSE_SERVER_URL` = `https://parseapi.back4app.com/`
5. Deploy the site.
6. Add the final Netlify URL to this README.

## How the Review Works

KnightLens parses the PGN with chess.js and creates the position before and after every move. Stockfish analyzes the positions using MultiPV so the application can keep up to five candidate moves. The played move is compared with Stockfish's evaluation to estimate centipawn loss and assign a move label.

A possible Brilliant move is only marked when the played move is Stockfish's first choice, has very low evaluation loss, and appears to offer a valuable piece that the opponent can capture while the position remains sound. This is intentionally a simple project heuristic rather than an attempt to reproduce another site's private scoring system.

## AI-Assisted Development

AI was used to help plan the specification, generate and revise code, organize the project, catch implementation issues, and prepare documentation. Generated code was structured into small modules so the major pieces can still be explained during the demo: PGN parsing, Stockfish analysis, authentication/database access, board rendering, and UI state.

## License / Third-Party Software

See `THIRD_PARTY_NOTICES.md`. Stockfish is distributed under GPL-3.0. The engine files are copied from the installed `stockfish` npm package during development/build.
