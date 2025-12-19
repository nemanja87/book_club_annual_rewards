import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import { BookResult, CategoryResult, Club, ClubConfigResponse, RevealResultsResponse } from '../api/types';
import nominatedTrack from '../sounds/nominated.mp3';
import winnerTrack from '../sounds/winner.mp3';

type Phase = 'loading' | 'open' | 'ready' | 'error';
type RevealStage = 'nominees' | 'countdown' | 'tie' | 'winner';

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
  const [revealedTopCount, setRevealedTopCount] = useState(0);
  const [revealingTop, setRevealingTop] = useState(false);
  const [displayContenders, setDisplayContenders] = useState<BookResult[]>([]);
  const revealIntervalRef = useRef<number | null>(null);
  const [tieCandidates, setTieCandidates] = useState<BookResult[]>([]);
  const [tieModalOpen, setTieModalOpen] = useState(false);
  const [tieSecondsLeft, setTieSecondsLeft] = useState(120);
  const tieTimerRef = useRef<number | null>(null);
  const [manualWinnerId, setManualWinnerId] = useState<number | null>(null);
  const [manualWinners, setManualWinners] = useState<Record<number, number>>({});
  const [showComplete, setShowComplete] = useState(false);
  const [bookOptionsCount, setBookOptionsCount] = useState(0);
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
      setBookOptionsCount(data.books.length);
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
    setRevealedTopCount(0);
    setRevealingTop(false);
    setManualWinnerId(manualWinners[currentCategory?.category_id ?? -1] ?? null);
    setTieModalOpen(false);
    setTieCandidates([]);
    setTieSecondsLeft(120);
    setShowComplete(false);
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
      if (tieTimerRef.current !== null) {
        window.clearInterval(tieTimerRef.current);
        tieTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (revealStage !== 'countdown') return;
    setCountdown(5);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleCountdownComplete();
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

  const getTopTies = (): BookResult[] => {
    if (!currentCategory || !currentCategory.results.length) return [];
    const sorted = [...currentCategory.results].sort((a, b) => b.weighted_score - a.weighted_score);
    const topScore = sorted[0]?.weighted_score ?? 0;
    const epsilon = 0.000001;
    return sorted.filter((entry) => Math.abs(entry.weighted_score - topScore) < epsilon);
  };

  const openTieModal = (candidates: BookResult[]) => {
    setTieCandidates(candidates);
    setTieSecondsLeft(120);
    setTieModalOpen(true);
    if (tieTimerRef.current !== null) {
      window.clearInterval(tieTimerRef.current);
    }
    tieTimerRef.current = window.setInterval(() => {
      setTieSecondsLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);
  };

  const closeTieModal = () => {
    if (tieTimerRef.current !== null) {
      window.clearInterval(tieTimerRef.current);
      tieTimerRef.current = null;
    }
    setTieModalOpen(false);
  };

  const handleCountdownComplete = () => {
    const ties = getTopTies();
    if (ties.length > 1) {
      setRevealStage('tie');
      openTieModal(ties);
      return;
    }
    setRevealStage('winner');
  };

  const selectTieWinner = (bookId: number) => {
    if (currentCategory) {
      setManualWinners((prev) => ({ ...prev, [currentCategory.category_id]: bookId }));
    }
    setManualWinnerId(bookId);
    closeTieModal();
    setRevealStage('winner');
  };

  const formatTimer = (value: number) => {
    const mins = Math.floor(value / 60)
      .toString()
      .padStart(2, '0');
    const secs = Math.floor(value % 60)
      .toString()
      .padStart(2, '0');
    return `${mins}:${secs}`;
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
    setShowComplete(false);
  };

  const goToNext = () => {
    if (revealStage !== 'winner') return;
    if (currentIndex >= results.length - 1) {
        setShowComplete(true);
        return;
    }
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
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const totalBooks = bookOptionsCount || allBooksPool.length;
    const finalWinners = results.map((cat) => {
      const chosenId =
        manualWinners[cat.category_id] ??
        cat.results.find((entry) => entry.is_winner)?.book_id ??
        cat.results[0]?.book_id;
      const winnerEntry = cat.results.find((entry) => entry.book_id === chosenId) ?? cat.results[0];
      return { category: cat.category_name, winner: winnerEntry };
    });

    if (showComplete) {
      return (
        <div className="card finish-card fade-in-up">
          <p className="finish-eyebrow">We did it!</p>
          <h2 className="finish-heading">
            Ladies and gentlemen, a round of applause for your winners.
          </h2>
          <div className="winners-table" aria-label="Award winners">
            {finalWinners.map(({ category, winner }) => (
              <div key={category} className="winner-row">
                <div className="winner-col">
                  <span className="winner-category">{category}</span>
                </div>
                <div className="winner-col">
                  <span className="winner-book">{winner?.title ?? '—'}</span>
                  {winner?.author && <span className="winner-author"> by {winner.author}</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="finish-bottom">
            <h2>Thank you for an amazing {currentYear}.</h2>
            <p>
              Together we explored <strong>{totalBooks}</strong> books this year. Here&apos;s to an even
              brighter {nextYear} filled with new stories, laughs, and late-night page turns.
            </p>
            <p className="finish-signoff">Happy reading! 📚</p>
          </div>
        </div>
      );
    }

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

    const winner =
      (manualWinnerId !== null
        ? currentCategory.results.find((entry) => entry.book_id === manualWinnerId)
        : null) ||
      (manualWinners[currentCategory.category_id]
        ? currentCategory.results.find((entry) => entry.book_id === manualWinners[currentCategory.category_id])
        : null) ||
      currentCategory.results.find((entry) => entry.is_winner);
    const sortedResults = [...currentCategory.results].sort(
      (a, b) => b.weighted_score - a.weighted_score
    );
    const hideDetails = revealStage !== 'winner';
    const gridClass = `nominee-grid ${displayContenders.length === 3 ? 'three-items' : ''}`;
    const isWinningEntry = (entry: BookResult) => {
      const targetId =
        manualWinnerId ??
        manualWinners[currentCategory.category_id] ??
        currentCategory.results.find((e) => e.is_winner)?.book_id;
      return revealStage === 'winner' && targetId === entry.book_id;
    };

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
                  className={`nominee-chip ${
                    isWinningEntry(entry) ? 'nominee-chip-winner' : ''
                  } ${
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

        </div>
      </>
    );
  };

  return (
    <div className="reveal-page">
      {tieModalOpen && (
        <div className="tie-overlay" role="dialog" aria-modal="true">
          <div className="tie-card">
            <p className="tie-label">It&apos;s a tie!</p>
            <h3 className="tie-title">Please discuss and pick the winner aloud.</h3>
            <p className="tie-subtext">
              Choose the final winner below once your group agrees.
            </p>
            <div className="tie-timer">⏱ {formatTimer(tieSecondsLeft)}</div>
            <div className="tie-options">
              {tieCandidates.map((candidate) => (
                <button
                  key={candidate.book_id}
                  className="tie-option"
                  onClick={() => selectTieWinner(candidate.book_id)}
                >
                  <strong>{candidate.title}</strong>
                  {candidate.author && <span className="muted"> by {candidate.author}</span>}
                  <span className="muted">
                    Score {candidate.weighted_score.toFixed(3)} · Votes {candidate.votes_count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
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
      {!showComplete && (
        <div className="reveal-nav">
          <button className="button secondary" onClick={goToPrevious} disabled={currentIndex === 0}>
            Previous
          </button>
          <button
            className="button"
            onClick={goToNext}
            disabled={revealStage !== 'winner'}
          >
            {currentIndex >= results.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      )}
    </div>
  );
}
