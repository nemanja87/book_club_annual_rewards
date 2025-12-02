import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import {
  Book,
  Category,
  ClubConfigResponse,
  ResultsResponse
} from '../api/types';

export default function AdminClubPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [config, setConfig] = useState<ClubConfigResponse | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newBook, setNewBook] = useState({ title: '', author: '', readers_count: 0 });
  const [newCategory, setNewCategory] = useState({ name: '', description: '', sort_order: 0 });
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

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

  const parseCsv = (text: string) => {
    const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!rows.length) return [];
    const headers = rows[0].split(',').map((h) => h.trim().toLowerCase());
    return rows.slice(1).map((line) => {
      const cols = line.split(',').map((c) => c.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = cols[idx] ?? '';
      });
      return row;
    });
  };

  const importBooks = async (items: Array<Partial<Book>>) => {
    if (!slug || !items.length) return;
    setIsImporting(true);
    try {
      const payloads = items.map((item, idx) => ({
        title: item.title ?? `Book ${idx + 1}`,
        author: item.author ?? '',
        readers_count: Number(item.readers_count) || 0
      }));
      const responses = await Promise.all(
        payloads.map((data) => api.post<Book>(`/api/admin/clubs/${slug}/books`, data).then((res) => res.data))
      );
      setBooks((prev) => [...prev, ...responses]);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Unable to import books');
    } finally {
      setIsImporting(false);
    }
  };

  const importCategories = async (items: Array<Partial<Category>>) => {
    if (!slug || !items.length) return;
    setIsImporting(true);
    try {
      const payloads = items.map((item, idx) => ({
        name: item.name ?? `Category ${idx + 1}`,
        description: item.description ?? '',
        sort_order: Number(item.sort_order ?? idx)
      }));
      const responses = await Promise.all(
        payloads.map((data) =>
          api.post<Category>(`/api/admin/clubs/${slug}/categories`, data).then((res) => res.data)
        )
      );
      setCategories((prev) => [...prev, ...responses]);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Unable to import categories');
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = async (
    fileList: FileList | null,
    type: 'books' | 'categories'
  ) => {
    if (!fileList || !fileList.length) return;
    const file = fileList[0];
    const text = await file.text();
    let items: Array<Record<string, any>> = [];
    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          items = parsed;
        }
      } else {
        items = parseCsv(text);
      }
    } catch (err) {
      setError('Unable to parse file. Use JSON array or CSV.');
      return;
    }
    if (!items.length) {
      setError('No rows found in file.');
      return;
    }
    if (type === 'books') {
      await importBooks(items);
    } else {
      await importCategories(items);
    }
  };

  if (!config) {
    return (
      <div className="container">
        <p>{error ?? 'Loading club...'}</p>
      </div>
    );
  }

  const shareUrl = slug ? `${window.location.origin}/club/${slug}` : '';
  const revealUrl = slug ? `/reveal/${slug}` : '';

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
        {!config.club.voting_open && revealUrl && (
          <button className="button gold" onClick={() => navigate(revealUrl)}>
            Go to ceremony page
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
            <label style={{ display: 'block' }}>
              <span className="muted" style={{ display: 'block', marginBottom: '0.35rem' }}>
                Upload books (CSV or JSON array)
              </span>
              <input
                type="file"
                accept=".csv,application/json,.json,text/csv"
                disabled={isImporting}
                onChange={(e) => {
                  handleFileUpload(e.target.files, 'books');
                  e.target.value = '';
                }}
              />
              <span className="muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                CSV headers: title, author, readers_count
              </span>
            </label>
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
            <label style={{ display: 'block' }}>
              <span className="muted" style={{ display: 'block', marginBottom: '0.35rem' }}>
                Upload categories (CSV or JSON array)
              </span>
              <input
                type="file"
                accept=".csv,application/json,.json,text/csv"
                disabled={isImporting}
                onChange={(e) => {
                  handleFileUpload(e.target.files, 'categories');
                  e.target.value = '';
                }}
              />
              <span className="muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                CSV headers: name, description, sort_order
              </span>
            </label>
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
