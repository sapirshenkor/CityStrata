import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './UserBar.css'

export default function UserBar() {
  const { user, loading, logout } = useAuth()

  if (loading) {
    return (
      <header className="user-bar" role="banner" aria-busy="true">
        <div className="user-bar__inner user-bar__inner--guest">
          <span className="user-bar__loading">…</span>
        </div>
      </header>
    )
  }

  if (!user) {
    return (
      <header className="user-bar" role="banner">
        <div className="user-bar__inner user-bar__inner--guest">
          <span className="user-bar__guest-label">Browsing as guest</span>
          <Link className="user-bar__link" to="/login">
            Sign in
          </Link>
          <Link className="user-bar__link user-bar__link--primary" to="/signup">
            Sign up
          </Link>
        </div>
      </header>
    )
  }

  const label = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email

  return (
    <header className="user-bar" role="banner">
      <div className="user-bar__inner">
        <span className="user-bar__name" title={user.email}>
          {label}
        </span>
        {user.role ? <span className="user-bar__role">{user.role}</span> : null}
        <button type="button" className="user-bar__logout" onClick={() => logout()}>
          Log out
        </button>
      </div>
    </header>
  )
}
