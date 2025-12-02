import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './pages/App';
import VotingPage from './pages/VotingPage';
import AdminHomePage from './pages/AdminHomePage';
import AdminClubPage from './pages/AdminClubPage';
import RevealPage from './pages/RevealPage';
import AboutPage from './pages/AboutPage';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/club/:slug" element={<VotingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/reveal/:slug" element={<RevealPage />} />
        <Route path="/admin" element={<AdminHomePage />} />
        <Route path="/admin/:slug" element={<AdminClubPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
