import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import { Book, Category, ClubConfigResponse, VoteSubmissionResponse } from '../api/types';
import CategoryStepper from '../components/CategoryStepper';
import BookOption from '../components/BookOption';

export default function VotingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [config, setConfig] = useState<ClubConfigResponse | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voterName, setVoterName] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      return;
    }
    setLoading(true);
    api
      .get<ClubConfigResponse>(`/api/clubs/${slug}/config`)
      .then((response) => {
        setConfig(response.data);
        setBooks(response.data.books);
        setCategories(response.data.categories);
        setSelected({});
        setCurrentIndex(0);
        setError(null);
        setMessage(null);
      })
      .catch(() => {
        setError('Club not found');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const bookMap = useMemo(() => {
    const map: Record<number, Book> = {};
    books.forEach((book) => {
      map[book.id] = book;
    });
    return map;
  }, [books]);

  if (!slug) {
    return null;
  }

  const handleNext = () => setCurrentIndex((prev) => Math.min(prev + 1, categories.length - 1));
  const handlePrev = () => setCurrentIndex((prev) => Math.max(prev - 1, 0));

  const handleSelect = (categoryId: number, bookId: number) => {
    setSelected((prev) => ({ ...prev, [categoryId]: bookId }));
  };

  const handleSubmit = async () => {
    if (!voterName.trim()) {
      setMessage('Please enter your name.');
      return;
    }
    if (!Object.keys(selected).length) {
      setMessage('Select at least one category.');
      return;
    }
    try {
      const payload = {
        voter_name: voterName,
        votes: Object.entries(selected).map(([categoryId, bookId]) => ({
          category_id: Number(categoryId),
          book_id: bookId
        }))
      };
      const response = await api.post<VoteSubmissionResponse>(`/api/clubs/${slug}/vote`, payload);
      setMessage(`Thanks ${response.data.voter.name}! Your votes are saved.`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? 'Unable to submit votes';
      setMessage(detail);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <p>Loading club...</p>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="container">
        <p>{error ?? 'Unable to load club'}</p>
        <button className="button" onClick={() => navigate('/')}>Back</button>
      </div>
    );
  }

  const currentCategory = categories[currentIndex];
  const votingClosed = !config.club.voting_open;

  return (
    <div className="container">
      <h1>{config.club.name}</h1>
      <p className="muted">Voting is {votingClosed ? 'closed' : 'open'}.</p>

      <div className="card">
        <label>
          Your name
          <input
            type="text"
            value={voterName}
            onChange={(event) => setVoterName(event.target.value)}
            disabled={votingClosed}
          />
        </label>
      </div>

      <CategoryStepper categories={categories} currentIndex={currentIndex} onNavigate={setCurrentIndex} />

      {currentCategory ? (
        <div className="card">
          <h2>{currentCategory.name}</h2>
          {currentCategory.description && <p>{currentCategory.description}</p>}
          {books.map((book) => (
            <BookOption
              key={`${currentCategory.id}-${book.id}`}
              groupName={`category-${currentCategory.id}`}
              book={book}
              selected={selected[currentCategory.id] === book.id}
              disabled={votingClosed}
              onSelect={(bookId) => handleSelect(currentCategory.id, bookId)}
            />
          ))}
          <div className="actions">
            <button className="button secondary" onClick={handlePrev} disabled={currentIndex === 0}>
              Previous
            </button>
            {currentIndex < categories.length - 1 ? (
              <button className="button" onClick={handleNext} disabled={currentIndex >= categories.length - 1}>
                Next
              </button>
            ) : (
              <button className="button" onClick={handleSubmit} disabled={votingClosed}>
                Submit all votes
              </button>
            )}
          </div>
        </div>
      ) : (
        <p>No categories configured yet.</p>
      )}

      {message && <p className="muted">{message}</p>}
    </div>
  );
}
