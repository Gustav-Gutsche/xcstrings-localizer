// Dev-only showcase used by scripts/take-screenshots.mjs to capture feature
// dialogs with realistic data. Activated via ?demo=<scenario> on localhost,
// never rendered in production builds (guarded by import.meta.env.DEV in App.jsx).
import {
  AstroSuggestionsDialog,
  KeywordReviewDialog,
  CompetitorPickerDialog,
} from './appstore/ASOKeywordsCard'

const noop = () => {}

const SUGGESTIONS_FIXTURE = {
  locale: 'en-US',
  localeName: 'English (U.S.)',
  localizationId: 'demo',
  currentKeywords: 'fitness,workout,gym tracker,calorie counter',
  title: 'AppCompete Suggestions',
  suggestions: [
    { keyword: 'home workout', popularity: 72, difficulty: 38, appsCount: 214, existing: false },
    { keyword: 'weight loss app', popularity: 68, difficulty: 55, appsCount: 312, existing: false },
    { keyword: 'hiit timer', popularity: 61, difficulty: 22, appsCount: 96, existing: false },
    { keyword: 'step counter', popularity: 58, difficulty: 47, appsCount: 187, existing: false },
    { keyword: 'workout', popularity: 57, difficulty: 64, appsCount: 451, existing: true },
    { keyword: 'strength training log', popularity: 49, difficulty: 18, appsCount: 64, existing: false },
    { keyword: 'intermittent fasting', popularity: 47, difficulty: 41, appsCount: 142, existing: false },
    { keyword: 'gym tracker', popularity: 44, difficulty: 29, appsCount: 88, existing: true },
    { keyword: 'running coach', popularity: 41, difficulty: 35, appsCount: 121, existing: false },
    { keyword: 'macro tracker', popularity: 38, difficulty: 26, appsCount: 73, existing: false },
    { keyword: 'pilates at home', popularity: 33, difficulty: 14, appsCount: 41, existing: false },
    { keyword: 'morning stretch routine', popularity: 27, difficulty: 9, appsCount: 23, existing: false },
  ],
}

const REVIEW_FIXTURE = {
  locale: 'en-US',
  localeName: 'English (U.S.)',
  items: [
    { keyword: 'gym tracker', tracked: true, position: 3, popularity: 44, difficulty: 29, verdict: 'great', advice: 'Ranked #3 — keep it.' },
    { keyword: 'workout', tracked: true, position: 24, popularity: 57, difficulty: 64, verdict: 'ok', advice: 'Ranked #24 — room to grow.' },
    { keyword: 'calisthenics plan', tracked: true, position: null, popularity: 8, difficulty: 12, verdict: 'weak', advice: 'Very low search volume — consider replacing it.' },
    { keyword: 'fitness', tracked: true, position: 118, popularity: 74, difficulty: 81, verdict: 'hard', advice: 'Highly competitive — hard to rank, target a longer-tail variant.' },
    { keyword: 'calorie counter', tracked: false, verdict: 'unknown', advice: 'Not tracked on AppCompete — add it to see rankings and popularity.' },
  ],
}

const COMPETITORS_FIXTURE = {
  locale: 'en-US',
  apps: [
    { appleId: '1', name: 'PumpFit — Gym Workout Log', keywordCount: 142, icon: null },
    { appleId: '2', name: 'CalSnap: Calorie Counter', keywordCount: 98, icon: null },
    { appleId: '3', name: 'RunMate Running Coach', keywordCount: 64, icon: null },
    { appleId: '4', name: 'StretchDaily', keywordCount: 37, icon: null },
  ],
}

export default function DemoShowcase() {
  const scenario = new URLSearchParams(window.location.search).get('demo')
  if (!scenario) return null

  switch (scenario) {
    case 'suggestions':
      return (
        <AstroSuggestionsDialog
          astroSuggestions={SUGGESTIONS_FIXTURE}
          onClose={noop}
          onApply={noop}
          isSaving={false}
        />
      )
    case 'review':
      return <KeywordReviewDialog review={REVIEW_FIXTURE} onClose={noop} onTrack={noop} />
    case 'competitors':
      return <CompetitorPickerDialog picker={COMPETITORS_FIXTURE} onClose={noop} onPick={noop} />
    default:
      return null
  }
}
