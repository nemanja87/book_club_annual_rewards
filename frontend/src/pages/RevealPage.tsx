import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import {
  CategoryResult,
  Club,
  ClubConfigResponse,
  RevealResultsResponse
} from '../api/types';

type Phase = 'loading' | 'open' | 'ready' | 'error';

export default function RevealPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [club, setClub] = useState<Club | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [results, setResults] = useState<CategoryResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(true);
  const [showNominees, setShowNominees] = useState(false);

  const fetchRevealResults = async () => {
    if (!slug) return;
    try {
      const { data } = await api.get<RevealResultsResponse>(`/api/clubs/${slug}/results/reveal`);
      setResults(data.results);
      setPhase('ready');
      setCurrentIndex(0);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Unable to load reveal results');
      setPhase('error');
    }
  };

  const loadClubState = async () => {
    if (!slug) return;
    setPhase('loading');
    try {
      const { data } = await api.get<ClubConfigResponse>(`/api/clubs/${slug}/config`);
      setClub(data.club);
      if (data.club.voting_open) {
        setPhase('open');
        setResults([]);
      } else {
        await fetchRevealResults();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Unable to load club');
      setPhase('error');
    }
  };

  useEffect(() => {
    loadClubState();
  }, [slug]);

  useEffect(() => {
    if (phase === 'ready') {
      setShowNominees(false);
      setIsRevealing(true);
      const timer = setTimeout(() => setIsRevealing(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, phase]);

  const currentCategory = results[currentIndex];

  const renderContent = () => {
    if (phase === 'loading') {
      return <p className="reveal-message">Preparing the stage...</p>;
    }
    if (phase === 'error') {
      return (
        <>
          <p className="reveal-message">Something went wrong.</p>
          {error && <p className="reveal-subtext">{error}</p>}
        </>
      );
    }
    if (phase === 'open') {
      return (
        <>
          <h1 className="reveal-title">Voting is still in progress</h1>
          <p className="reveal-subtext">
            Come back once the admin closes voting to reveal the winners.
          </p>
          <button className="button" onClick={loadClubState}>
            Refresh status
          </button>
        </>
      );
    }
    if (!currentCategory) {
      return (
        <>
          <p className="reveal-message">No categories to reveal yet.</p>
          <button className="button" onClick={() => navigate(`/admin/${slug}`)}>
            Back to admin
          </button>
        </>
      );
    }

    const winner = currentCategory.results.find((entry) => entry.is_winner);

    return (
      <>
        <div className="category-card fade-in-up">
          <p className="category-count">
            Category {currentIndex + 1} of {results.length}
          </p>
          <h2 className="category-name">{currentCategory.category_name}</h2>
          {club?.name && <p className="category-club">{club.name}</p>}
          {isRevealing ? (
            <p className="drum-roll">And the winner is...</p>
          ) : winner ? (
            <div className="winner-card">
              <p className="winner-label">Winner</p>
              <h3 className="winner-title">{winner.title}</h3>
              {winner.author && <p className="winner-author">by {winner.author}</p>}
              <div className="winner-meta">
                <span>{winner.votes_count} votes</span>
                <span>{winner.readers_count} readers</span>
                <span>Score {winner.weighted_score.toFixed(3)}</span>
              </div>
            </div>
          ) : (
            <p className="drum-roll">No winner data.</p>
          )}
          <button className="button secondary" onClick={() => setShowNominees((prev) => !prev)}>
            {showNominees ? 'Hide nominees' : 'Show nominees'}
          </button>
          {showNominees && (
            <table className="nominee-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Readers</th>
                  <th>Votes</th>
                  <th>Weighted</th>
                </tr>
              </thead>
              <tbody>
                {currentCategory.results.map((entry) => (
                  <tr key={entry.book_id} className={entry.is_winner ? 'winner-row' : ''}>
                    <td>
                      {entry.title}
                      {entry.author && <span className="muted"> by {entry.author}</span>}
                    </td>
                    <td>{entry.readers_count}</td>
                    <td>{entry.votes_count}</td>
                    <td>{entry.weighted_score.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="reveal-nav">
          <button
            className="button secondary"
            onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
            disabled={currentIndex === 0}
          >
            Previous
          </button>
          <button
            className="button"
            onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, results.length - 1))}
            disabled={currentIndex >= results.length - 1}
          >
            Next
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="reveal-page">
      {club && <p className="reveal-club">Awards Ceremony · {club.name}</p>}
      {renderContent()}
    </div>
  );
}
