export type PostCategory = "momentum" | "friction" | "use_case" | "feature_request";
export type Sentiment = "negative" | "positive" | "neutral";
export type PostSource = "reddit" | "hackernews";

export interface PulsePost {
  id: string;
  collected_run: string; // "YYYY-MM-DD"
  title: string;
  subreddit: string; // or "hackernews" for HN posts
  source: PostSource;
  score: number;
  num_comments: number;
  url: string;
  selftext_snippet: string; // first 300 chars
  category: PostCategory;
  tags: string[];
  sentiment: Sentiment;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface PmPriority {
  title: string;
  why: string[]; // 2-3 bullet points
  metric: string;
  roi_estimate: string;
  impact_level: "High" | "Medium" | "Low";
  effort_level: "High" | "Medium" | "Low";
  supporting_post_ids: string[];
}

export interface PmAnalysis {
  top_priority: PmPriority;
  secondary_priorities: PmPriority[];
}

export interface CategoryCounts {
  momentum: number;
  friction: number;
  use_case: number;
  feature_request: number;
}

export interface Delta {
  momentum_pct_change: number;
  friction_pct_change: number;
  use_case_pct_change: number;
  feature_request_pct_change: number;
  top_emerging_tag: string | null;
}

export interface RunSummary {
  run_date: string; // "YYYY-MM-DD"
  day: string; // "Monday"
  total_new_posts: number;
  cumulative_total: number;
  categories: CategoryCounts;
  top_tags: TagCount[];
  new_feature_requests: string[];
  delta_vs_last: Delta | null;
  pm_analysis: PmAnalysis;
}
