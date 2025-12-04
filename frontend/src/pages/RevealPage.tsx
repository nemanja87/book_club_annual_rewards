import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import { BookResult, CategoryResult, Club, ClubConfigResponse, RevealResultsResponse } from '../api/types';
import nominatedTrack from '../sounds/nominated.mp3';
import winnerTrack from '../sounds/winner.mp3';

type Phase = 'loading' | 'open' | 'ready' | 'error';
type RevealStage = 'nominees' | 'countdown' | 'winner';

export default function RevealPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [club, setClub] = useState<Club | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [results, setResults] = useState<CategoryResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [revealStage, setRevealStage] = useState<RevealStage>('nominees');
  const [countdown, setCountdown] = useState(5);
  const [fireworksActive, setFireworksActive] = useState(false);
  const [showNominees, setShowNominees] = useState(false);
  const [revealedTopCount, setRevealedTopCount] = useState(0);
  const [revealingTop, setRevealingTop] = useState(false);
  const [displayContenders, setDisplayContenders] = useState<BookResult[]>([]);
  const revealIntervalRef = useRef<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const nominatedAudioRef = useRef<HTMLAudioElement | null>(null);
  const winnerAudioRef = useRef<HTMLAudioElement | null>(null);

  const currentCategory = results[currentIndex] ?? null;

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
    if (!results.length) {
      setCurrentIndex(0);
      return;
    }
    if (currentIndex > results.length - 1) {
      setCurrentIndex(0);
    }
  }, [results]);

  useEffect(() => {
    if (phase !== 'ready') return;
    setRevealStage('nominees');
    setCountdown(5);
    setFireworksActive(false);
    setShowNominees(false);
    setRevealedTopCount(0);
    setRevealingTop(false);
    stopAllAudio();
    playNominatedTrack(true);
    clearRevealInterval();
  }, [currentIndex, phase]);

  const allBooksPool = useMemo(() => {
    const map = new Map<number, BookResult>();
    results.forEach((category) => {
      category.results.forEach((book) => {
        if (!map.has(book.book_id)) {
          map.set(book.book_id, book);
        }
      });
    });
    return Array.from(map.values());
  }, [results]);

  useEffect(() => {
    if (!currentCategory) {
      setDisplayContenders([]);
      return;
    }
    const sorted = [...currentCategory.results].sort((a, b) => b.weighted_score - a.weighted_score);
    const display: BookResult[] = [];
    sorted.forEach((item) => {
      if (display.length < 3 && !display.find((b) => b.book_id === item.book_id)) {
        display.push(item);
      }
    });
    const fillerPool = allBooksPool.filter(
      (item) => !display.find((b) => b.book_id === item.book_id)
    );
    while (display.length < 3 && fillerPool.length) {
      const idx = Math.floor(Math.random() * fillerPool.length);
      display.push(fillerPool.splice(idx, 1)[0]);
    }
    const trimmed = display.slice(0, 3);
    // Shuffle so winner is not always first
    for (let i = trimmed.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [trimmed[i], trimmed[j]] = [trimmed[j], trimmed[i]];
    }
    const winnerIdx = trimmed.findIndex((entry) => entry.is_winner);
    if (winnerIdx === 0 && trimmed.length > 1) {
      const swapWith = Math.floor(Math.random() * (trimmed.length - 1)) + 1;
      [trimmed[0], trimmed[swapWith]] = [trimmed[swapWith], trimmed[0]];
    }
    setDisplayContenders(trimmed);
  }, [currentCategory, allBooksPool]);

  useEffect(() => {
    if (revealStage !== 'nominees') return;
    if (!displayContenders.length) return;
    if (revealedTopCount > 0 || revealingTop) return;
    revealTopThree(displayContenders.length);
  }, [displayContenders, revealStage, revealedTopCount, revealingTop]);

  useEffect(() => {
    return () => {
      stopAllAudio();
      clearRevealInterval();
    };
  }, []);

  useEffect(() => {
    if (revealStage !== 'countdown') return;
    setCountdown(5);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setRevealStage('winner');
          return 0;
        }
        playTick();
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [revealStage]);

  useEffect(() => {
    if (revealStage === 'nominees') {
      playNominatedTrack(true);
    }
    if (revealStage !== 'winner') return;
    setFireworksActive(true);
    const timer = setTimeout(() => setFireworksActive(false), 4500);
    return () => clearTimeout(timer);
  }, [revealStage]);

  const playTick = () => {
    try {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtor) return;
      const ctx = new AudioCtor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 900;
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch (err) {
      console.warn('Tick audio failed', err);
    }
  };

  const playChime = () => {
    try {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtor) return;
      const ctx = new AudioCtor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 660;
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.1, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.55);
    } catch (err) {
      console.warn('Chime audio failed', err);
    }
  };

  const stopAllAudio = () => {
    const audios = [nominatedAudioRef.current, winnerAudioRef.current];
    audios.forEach((audio) => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  };

  const playNominatedTrack = (force = false) => {
    if (!soundEnabled && !force) return;
    stopWinnerTrack();
    try {
      if (!nominatedAudioRef.current) {
        nominatedAudioRef.current = new Audio(nominatedTrack);
        nominatedAudioRef.current.loop = true;
        nominatedAudioRef.current.volume = 0.35;
      }
      const audio = nominatedAudioRef.current;
      audio.currentTime = 0;
      audio.play().catch((err) => console.warn('Unable to play nominated track', err));
    } catch (err) {
      console.warn('Nominated audio failed', err);
    }
  };

  const stopWinnerTrack = () => {
    const audio = winnerAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  };

  const playWinnerTrack = (force = false) => {
    if (!soundEnabled && !force) return;
    stopNominatedTrack();
    try {
      if (!winnerAudioRef.current) {
        winnerAudioRef.current = new Audio(winnerTrack);
        winnerAudioRef.current.loop = true;
        winnerAudioRef.current.volume = 0.35;
      }
      const audio = winnerAudioRef.current;
      audio.currentTime = 0;
      audio.play().catch((err) => console.warn('Unable to play winner track', err));
    } catch (err) {
      console.warn('Winner audio failed', err);
    }
  };

  const stopNominatedTrack = () => {
    const audio = nominatedAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  };

  const startCountdown = () => {
    if (revealStage !== 'nominees') return;
    if (revealedTopCount < 3 && !revealingTop) return;
    setRevealStage('countdown');
    playWinnerTrack();
  };

  const clearRevealInterval = () => {
    if (revealIntervalRef.current) {
      clearInterval(revealIntervalRef.current);
      revealIntervalRef.current = null;
    }
  };

  const revealTopThree = (count: number) => {
    if (revealingTop) return;
    const total = Math.min(3, count);
    if (!total) return;
    setRevealingTop(true);
    playNominatedTrack();
    setRevealedTopCount(0);
    let current = 0;
    clearRevealInterval();
    const interval = window.setInterval(() => {
      current += 1;
      setRevealedTopCount(current);
      playChime();
      if (current >= total) {
        clearInterval(interval);
        setRevealingTop(false);
        revealIntervalRef.current = null;
      }
    }, 3000);
    revealIntervalRef.current = interval;
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
    stopAllAudio();
    clearRevealInterval();
  };

  const goToNext = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, results.length - 1));
    stopAllAudio();
    clearRevealInterval();
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (!next) {
      stopAllAudio();
      return;
    }
    if (revealStage === 'winner') {
      playWinnerTrack(true);
    } else {
      playNominatedTrack(true);
    }
  };

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
    const sortedResults = [...currentCategory.results].sort(
      (a, b) => b.weighted_score - a.weighted_score
    );
    const hideDetails = revealStage !== 'winner';
    const gridClass = `nominee-grid ${displayContenders.length === 3 ? 'three-items' : ''}`;

    return (
      <>
        <div className="category-card fade-in-up">
          <p className="category-count">
            Category {currentIndex + 1} of {results.length}
          </p>
          <h2 className="category-name">{currentCategory.category_name}</h2>
          {club?.name && <p className="category-club">{club.name}</p>}
          <div className="contenders">
            <div className="contenders-header">
              <span className="muted">Top contenders</span>
              <span className="muted">
                {hideDetails
                  ? 'Locked until reveal'
                  : `(${Math.min(displayContenders.length, sortedResults.length)} shown)`}
              </span>
            </div>
            <div className={gridClass}>
              {displayContenders.map((entry, index) => (
                <div
                  key={entry.book_id}
                  className={`nominee-chip ${entry.is_winner ? 'nominee-chip-winner' : ''} ${
                    hideDetails && index >= revealedTopCount ? 'nominee-chip-locked' : ''
                  }`}
                >
                  <div className="nominee-rank">#{index + 1}</div>
                  <div className="nominee-body">
                    <p
                      className={`nominee-title ${
                        hideDetails && index >= revealedTopCount ? 'obscured-text' : ''
                      }`}
                    >
                      {entry.title}
                    </p>
                    {entry.author && (
                      <p
                        className={`nominee-author ${
                          hideDetails && index >= revealedTopCount ? 'obscured-text' : ''
                        }`}
                      >
                        by {entry.author}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {revealStage === 'nominees' && (
            <div className="reveal-actions">
              <p className="drum-roll">Envelope sealed. Ready to reveal?</p>
              <div className="reveal-actions-row">
                <button
                  className="button gold"
                  onClick={startCountdown}
                  disabled={
                    revealingTop || revealedTopCount < Math.min(3, displayContenders.length)
                  }
                >
                Reveal winner
                </button>
              </div>
            </div>
          )}

          {revealStage === 'countdown' && (
            <div className="countdown-card">
              <p className="drum-roll">Opening the envelope...</p>
              <div className="countdown-ring">{countdown === 0 ? 'Go!' : countdown}</div>
              <p className="muted">Let the drum roll finish</p>
            </div>
          )}

          {revealStage === 'winner' &&
            (winner ? (
              <div className="winner-card pop-in">
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
            ))}

          <div className="nominee-toggle">
            <button className="button secondary" onClick={() => setShowNominees((prev) => !prev)}>
              {showNominees ? 'Hide full list' : 'Show full list'}
            </button>
          </div>
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
                {sortedResults.map((entry) => (
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
          <button className="button secondary" onClick={goToPrevious} disabled={currentIndex === 0}>
            Previous
          </button>
          <button
            className="button"
            onClick={goToNext}
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
      {fireworksActive && (
        <div className="fireworks">
          {Array.from({ length: 7 }).map((_, idx) => (
            <span key={idx} className={`firework firework-${idx + 1}`} />
          ))}
        </div>
      )}
      <div className="reveal-topbar">
        {club && <p className="reveal-club">Awards Ceremony · {club.name}</p>}
        <button className="sound-toggle" onClick={toggleSound} aria-label="Toggle sound">
          <span className="sound-icon">{soundEnabled ? '🔊' : '🔇'}</span>
          <span className="sound-label">{soundEnabled ? 'Sound on' : 'Muted'}</span>
        </button>
      </div>
      {renderContent()}
    </div>
  );
}
