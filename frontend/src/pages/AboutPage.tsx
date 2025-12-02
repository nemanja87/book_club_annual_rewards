import { Link } from 'react-router-dom';

export default function AboutPage() {
  return (
    <div className="container">
      <h1>About Book Club Awards</h1>
      <p className="muted">
        A light-weight tool to run annual awards inside any book club—from nominations to cinematic
        reveal night.
      </p>

      <div className="card">
        <h2>Purpose</h2>
        <p>
          The platform lets admins configure clubs, books, and custom categories so members can vote
          for their favorites. Votes are collected per category and the final winners are determined
          using a weighted score that accounts for how many people read each book. Once voting is
          closed, the public reveal page walks everyone through the winners.
        </p>
      </div>

      <div className="card">
        <h2>How voting works</h2>
        <ul>
          <li>Each voter identifies themselves with a name (no accounts required).</li>
          <li>Voters can cast one vote per category; submitting again overwrites their previous pick.</li>
          <li>
            Results show the raw vote count and a weighted score: <code>votes ÷ readers_count</code>.
            This favors books that a smaller audience has read while still rewarding popularity.
          </li>
          <li>
            If two books share the same weighted score, the one with the higher vote count takes the
            category.
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>Running an awards season</h2>
        <ol>
          <li>Create a club from the admin dashboard and share the slug with members.</li>
          <li>Add books with their readers count plus the categories you want to award.</li>
          <li>Keep voting open while members submit ballots at <code>/club/&lt;slug&gt;</code>.</li>
          <li>Close voting when you are ready and head to <code>/reveal/&lt;slug&gt;</code> for the ceremony.</li>
        </ol>
        <p>
          The reveal page is optimized for projecting on a screen—navigate category by category and
          watch the winners appear with some flair.
        </p>
      </div>

      <div className="card">
        <h2>Need to get started?</h2>
        <p>Jump straight into the admin dashboard to set up your first club.</p>
        <Link className="button" to="/admin">
          Go to Admin
        </Link>
      </div>
    </div>
  );
}
