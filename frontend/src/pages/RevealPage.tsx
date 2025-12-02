import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import {
  BookResult,
  CategoryResult,
  Club,
  ClubConfigResponse,
  RevealResultsResponse
} from '../api/types';

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
  const suspenseContextRef = useRef<AudioContext | null>(null);
  const fanfareContextRef = useRef<AudioContext | null>(null);
  const fireworkContextRef = useRef<AudioContext | null>(null);
  const contenderCacheRef = useRef<Record<number, BookResult[]>>({});

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
    if (phase !== 'ready') return;
    setRevealStage('nominees');
    setCountdown(5);
    setFireworksActive(false);
    setShowNominees(false);
    setRevealedTopCount(0);
    setRevealingTop(false);
  }, [currentIndex, phase]);

  useEffect(() => {
    return () => {
      suspenseContextRef.current?.close();
      fanfareContextRef.current?.close();
      fireworkContextRef.current?.close();
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
    if (revealStage !== 'winner') return;
    setFireworksActive(true);
    playFanfare();
    playFireworkBurst();
    const timer = setTimeout(() => setFireworksActive(false), 4500);
    return () => clearTimeout(timer);
  }, [revealStage]);

  const playSuspense = () => {
    try {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtor) return;
      const ctx = new AudioCtor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 1.6);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.7);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.8);
      suspenseContextRef.current = ctx;
    } catch (err) {
      console.warn('Suspense audio failed', err);
    }
  };

  const playFanfare = () => {
    try {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtor) return;
      const ctx = new AudioCtor();
      const tones = [880, 1175, 1568];
      tones.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const start = ctx.currentTime + idx * 0.08;
        const end = start + 0.7;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.09, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(end + 0.05);
      });
      fanfareContextRef.current = ctx;
    } catch (err) {
      console.warn('Fanfare audio failed', err);
    }
  };

  const playFireworkBurst = () => {
    try {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtor) return;
      const ctx = new AudioCtor();
      const duration = 1;
      const sampleRate = ctx.sampleRate;
      const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1800;
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      noise.connect(bandpass).connect(gain).connect(ctx.destination);
      noise.start(now);
      noise.stop(now + duration);
      fireworkContextRef.current = ctx;
    } catch (err) {
      console.warn('Firework audio failed', err);
    }
  };

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

  const startCountdown = () => {
    if (revealStage !== 'nominees') return;
    if (revealedTopCount < 3 && !revealingTop) return;
    setRevealStage('countdown');
    playSuspense();
  };

  const revealTopThree = (count: number) => {
    if (revealingTop) return;
    const total = Math.min(3, count);
    if (!total) return;
    setRevealingTop(true);
    setRevealedTopCount(0);
    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      setRevealedTopCount(current);
      playChime();
      if (current >= total) {
        clearInterval(interval);
        setRevealingTop(false);
      }
    }, 3000);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, results.length - 1));
  };

  const currentCategory = results[currentIndex];
  const prepareContenders = (category: CategoryResult) => {
    const sorted = [...category.results].sort((a, b) => b.weighted_score - a.weighted_score);
    const cached = contenderCacheRef.current[category.category_id];
    if (cached) return { sortedResults: sorted, displayContenders: cached };

    let display = sorted.slice(0, 5);
    if (display.length < 3 && sorted.length) {
      const used = new Set(display.map((b) => b.book_id));
      while (display.length < 3) {
        const pick = sorted[Math.floor(Math.random() * sorted.length)];
        if (!pick) break;
        if (!used.has(pick.book_id) || used.size === sorted.length) {
          display.push(pick);
          used.add(pick.book_id);
        }
      }
    }
    contenderCacheRef.current[category.category_id] = display;
    return { sortedResults: sorted, displayContenders: display };
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
    const { sortedResults, displayContenders } = prepareContenders(currentCategory);
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
                  className="button secondary"
                  onClick={() => revealTopThree(displayContenders.length)}
                  disabled={
                    revealingTop || revealedTopCount >= Math.min(3, displayContenders.length)
                  }
                >
                  Reveal top 3
                </button>
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
      {club && <p className="reveal-club">Awards Ceremony · {club.name}</p>}
      {renderContent()}
    </div>
  );
}
