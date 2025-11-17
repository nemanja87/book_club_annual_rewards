import { Link } from 'react-router-dom';

export default function App() {
  return (
    <div className="container">
      <h1>Book Club Awards</h1>
      <p>Create clubs, add categories and books, and let members vote.</p>
      <div className="card">
        <p>Head to the admin area to create a club, then share the voting link:</p>
        <Link className="button" to="/admin">
          Go to Admin
        </Link>
      </div>
    </div>
  );
}
