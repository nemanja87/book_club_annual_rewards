import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import {
  Book,
  Category,
  ClubConfigResponse,
  ResultsResponse
} from '../api/types';

export default function AdminClubPage() {
  const { slug } = useParams();
  const [config, setConfig] = useState<ClubConfigResponse | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newBook, setNewBook] = useState({ title: '', author: '', readers_count: 0 });
  const [newCategory, setNewCategory] = useState({ name: '', description: '', sort_order: 0 });
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!slug) return;
    api
      .get<ClubConfigResponse>(`/api/admin/clubs/${slug}`)
      .then((response) => {
        setConfig(response.data);
        setBooks(response.data.books);
        setCategories(response.data.categories);
        setError(null);
      })
      .catch((err) => setError(err.response?.data?.detail ?? 'Unable to load club'));
  };

  const loadResults = () => {
    if (!slug) return;
    api
      .get<ResultsResponse>(`/api/admin/clubs/${slug}/results`)
      .then((response) => setResults(response.data))
      .catch((err) => setError(err.response?.data?.detail ?? 'Unable to load results'));
  };

  useEffect(() => {
    load();
  }, [slug]);

  useEffect(() => {
    if (config && !config.club.voting_open) {
      loadResults();
    } else {
      setResults(null);
    }
  }, [config]);

  const handleVotingState = (openState: boolean) => {
    if (!slug) return;
    api
      .post(`/api/admin/clubs/${slug}/voting/${openState ? 'open' : 'close'}`)
      .then(({ data }) => {
        setConfig((prev) =>
          prev ? { ...prev, club: { ...prev.club, voting_open: data.voting_open } } : prev
        );
      })
      .then(() => {
        if (!openState) {
          loadResults();
        }
      })
      .catch((err) => setError(err.response?.data?.detail ?? 'Unable to update voting state'));
  };

  const handleBookCreate = (event: FormEvent) => {
    event.preventDefault();
    if (!slug) return;
    api
      .post<Book>(`/api/admin/clubs/${slug}/books`, newBook)
      .then(({ data }) => {
        setBooks((prev) => [...prev, data]);
        setNewBook({ title: '', author: '', readers_count: 0 });
      })
      .catch((err) => setError(err.response?.data?.detail ?? 'Unable to add book'));
  };

  const handleCategoryCreate = (event: FormEvent) => {
    event.preventDefault();
    if (!slug) return;
    api
      .post<Category>(`/api/admin/clubs/${slug}/categories`, {
        ...newCategory,
        sort_order: Number(newCategory.sort_order)
      })
      .then(({ data }) => {
        setCategories((prev) => [...prev, data]);
        setNewCategory({ name: '', description: '', sort_order: 0 });
      })
      .catch((err) => setError(err.response?.data?.detail ?? 'Unable to add category'));
  };

  if (!config) {
    return (
      <div className="container">
        <p>{error ?? 'Loading club...'}</p>
      </div>
    );
  }

  const shareUrl = slug ? `${window.location.origin}/club/${slug}` : '';

  return (
    <div className="container">
      <h1>{config.club.name}</h1>
      <p className="muted">Slug: {config.club.slug}</p>
      <div className="actions">
        <button className="button" onClick={() => handleVotingState(true)} disabled={config.club.voting_open}>
          Open voting
        </button>
        <button className="button secondary" onClick={() => handleVotingState(false)} disabled={!config.club.voting_open}>
          Close voting
        </button>
        {shareUrl && (
          <button className="button" onClick={() => window.open(shareUrl, '_blank')}>
            Go to voting page
          </button>
        )}
      </div>

      {error && <p className="muted">{error}</p>}

      <div className="grid">
        <div className="card">
          <h2>Books</h2>
          {books.map((book) => (
            <div key={book.id} className="list-item">
              <div>
                <strong>{book.title}</strong>
                {book.author && <span className="muted"> by {book.author}</span>}
                <div className="muted">Readers: {book.readers_count}</div>
              </div>
            </div>
          ))}
          <form className="stack" onSubmit={handleBookCreate}
            style={{ marginTop: '1rem' }}>
            <label>
              Title
              <input value={newBook.title} onChange={(e) => setNewBook({ ...newBook, title: e.target.value })} required />
            </label>
            <label>
              Author
              <input value={newBook.author} onChange={(e) => setNewBook({ ...newBook, author: e.target.value })} />
            </label>
            <label>
              Readers count
              <input
                type="number"
                min={0}
                value={newBook.readers_count}
                onChange={(e) => setNewBook({ ...newBook, readers_count: Number(e.target.value) })}
                required
              />
            </label>
            <button className="button" type="submit">
              Add book
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Categories</h2>
          {categories
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((category) => (
              <div key={category.id} className="list-item">
                <div>
                  <strong>{category.name}</strong>
                  {category.description && <div className="muted">{category.description}</div>}
                  <div className="muted">Order: {category.sort_order}</div>
                </div>
              </div>
            ))}
          <form className="stack" onSubmit={handleCategoryCreate}
            style={{ marginTop: '1rem' }}>
            <label>
              Name
              <input
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                required
              />
            </label>
            <label>
              Description
              <textarea
                value={newCategory.description}
                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
              />
            </label>
            <label>
              Sort order
              <input
                type="number"
                value={newCategory.sort_order}
                onChange={(e) => setNewCategory({ ...newCategory, sort_order: Number(e.target.value) })}
              />
            </label>
            <button className="button" type="submit">
              Add category
            </button>
          </form>
        </div>
      </div>

      {results && (
        <div className="card">
          <h2>Results</h2>
          {results.categories.map((category) => (
            <div key={category.category_id} className="results">
              <h3>{category.category_name}</h3>
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Readers</th>
                    <th>Votes</th>
                    <th>Weighted</th>
                  </tr>
                </thead>
                <tbody>
                  {category.results.map((result) => (
                    <tr key={result.book_id} className={result.is_winner ? 'winner' : ''}>
                      <td>{result.title}</td>
                      <td>{result.readers_count}</td>
                      <td>{result.votes_count}</td>
                      <td>{result.weighted_score.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
