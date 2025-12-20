export interface Club {
  id: number;
  name: string;
  slug: string;
  voting_open: boolean;
  created_at: string;
}

export interface Book {
  id: number;
  club_id: number;
  title: string;
  author?: string | null;
  readers_count: number;
  created_at: string;
}

export interface Category {
  id: number;
  club_id: number;
  name: string;
  description?: string | null;
  sort_order: number;
  active: boolean;
}

export interface ClubConfigResponse {
  club: Club;
  books: Book[];
  categories: Category[];
  best_member_nominees?: string[];
  best_member_nominees_detail?: BestMemberNominee[];
}

export interface VoteEntry {
  category_id: number;
  book_id: number;
}

export interface VoteSubmission {
  voter_name: string;
  votes: VoteEntry[];
}

export interface Voter {
  id: number;
  name: string;
  club_id: number;
  created_at: string;
}

export interface VoteRecord {
  id: number;
  voter_id: number;
  category_id: number;
  book_id: number;
}

export interface VoteSubmissionResponse {
  voter: Voter;
  updated_votes: VoteRecord[];
}

export interface BookResult {
  book_id: number;
  title: string;
  author?: string | null;
  readers_count: number;
  votes_count: number;
  weighted_score: number;
  is_winner: boolean;
}

export interface CategoryResult {
  category_id: number;
  category_name: string;
  results: BookResult[];
}

export interface ResultsResponse {
  club: Club;
  categories: CategoryResult[];
}

export interface RevealResultsResponse {
  status: 'ok';
  club: Club;
  results: CategoryResult[];
}

export interface RevealVotingOpenResponse {
  status: 'voting_open';
  message: string;
}

export interface BestMemberResult {
  nominee_name: string;
  votes_count: number;
  is_winner: boolean;
}

export interface BestMemberResultsResponse {
  club: Club;
  nominees: BestMemberResult[];
}

export interface BestMemberNominee {
  id: number;
  club_id: number;
  name: string;
}
