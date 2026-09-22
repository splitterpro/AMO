import { ShieldCheck } from 'lucide-react'
import './Header.css'

function Header() {
  return (
    <header className="app-header">
      <div className="app-header-brand">
        <svg className="app-logo-mark" width="32" height="32" viewBox="0 0 32 32" fill="none">
          <defs>
            <linearGradient id="logo-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--primary-gradient-start)" />
              <stop offset="1" stopColor="var(--primary-gradient-end)" />
            </linearGradient>
          </defs>
          <rect x="4" y="14" width="6" height="14" rx="2" fill="url(#logo-gradient)" />
          <rect x="13" y="8" width="6" height="20" rx="2" fill="url(#logo-gradient)" />
          <rect x="22" y="2" width="6" height="26" rx="2" fill="url(#logo-gradient)" />
        </svg>
        <div className="app-header-text">
          <span className="app-header-title">DataLens</span>
          <span className="app-header-subtitle">Explore your data. Find insights.</span>
        </div>
      </div>
      <div className="app-header-badge">
        <ShieldCheck size={16} strokeWidth={2} />
        <span>Your data stays private</span>
      </div>
    </header>
  )
}

export default Header
