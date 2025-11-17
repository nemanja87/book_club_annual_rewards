import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getAdminSecret, setAdminSecret } from '../api/client';
import { Club } from '../api/types';

export default function AdminHomePage() {
  const [secret, updateSecret] = useState(getAdminSecret() ?? '');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [newClub, setNewClub] = useState({ name: '', slug: '' });
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api
      .get<Club[]>('/api/admin/clubs')
      .then((response) => {
        setClubs(response.data);
        setError(null);
      })
      .catch((err) => setError(err.response?.data?.detail ?? 'Unable to load clubs'));
  };

  useEffect(() => {
    if (secret) {
      load();
    }
  }, [secret]);

  const handleSecretSave = () => {
    setAdminSecret(secret);
    load();
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.post('/api/admin/clubs', { ...newClub, voting_open: true });
      setNewClub({ name: '', slug: '' });
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Unable to create club');
    }
  };

  return (
    <div className="container">
      <h1>Admin</h1>
      <div className="card">
        <label>
          Admin Secret
          <input value={secret} onChange={(event) => updateSecret(event.target.value)} />
        </label>
        <button className="button" onClick={handleSecretSave}>
          Save Secret
        </button>
      </div>

      {error && <p className="muted">{error}</p>}

      <div className="card">
        <h2>Create Club</h2>
        <form onSubmit={handleCreate} className="stack">
          <label>
            Name
            <input value={newClub.name} onChange={(e) => setNewClub({ ...newClub, name: e.target.value })} required />
          </label>
          <label>
            Slug (letters, numbers, hyphen)
            <input value={newClub.slug} onChange={(e) => setNewClub({ ...newClub, slug: e.target.value })} required />
          </label>
          <button className="button" type="submit">
            Create
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Existing Clubs</h2>
        {clubs.map((club) => (
          <div key={club.id} className="list-item">
            <span>
              {club.name} ({club.slug})
            </span>
            <Link className="button secondary" to={`/admin/${club.slug}`}>
              Manage
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
