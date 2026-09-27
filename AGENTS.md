# KnightLens project rules

- Keep the project understandable for a student-level full-stack web assignment.
- Use vanilla JavaScript modules instead of adding a large frontend framework.
- Keep Stockfish analysis in the browser so chess positions do not need a paid engine API.
- Use Back4App/Parse for username/password authentication and saved game reviews.
- Never commit `.env` or any Back4App Master Key.
- A user must be logged in before creating, updating, or deleting saved review data.
- Preserve the required CRUD flow: create review, read history, update title/notes, delete review.
- Handle invalid PGN and backend errors with readable messages instead of console-only errors.
- Run `npm run build` before considering a feature finished.
