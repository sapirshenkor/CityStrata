import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** `onPrimary` = over gradient / AppHeader. `onSurface` = on card or PageHeader (dark token UI). */
export type UserBarVariant = 'onPrimary' | 'onSurface'

export default function UserBar({ variant = 'onPrimary' }: { variant?: UserBarVariant }) {
  const { user, loading, logout } = useAuth()
  const onSurface = variant === 'onSurface'

  if (loading) {
    return (
      <div
        className={cn(
          'flex items-center rounded-full px-3 py-1.5',
          onSurface
            ? 'border border-border bg-muted/50'
            : 'border border-white/30 bg-white/10',
        )}
      >
        <span
          className={cn('text-sm', onSurface ? 'text-muted-foreground' : 'text-white/90')}
          aria-busy="true"
        >
          …
        </span>
      </div>
    )
  }

  if (!user) {
    if (onSurface) {
      return (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-xs font-medium text-muted-foreground">Guest</span>
          <Button asChild variant="secondary" size="sm" className="h-8 rounded-full">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="h-8 rounded-full">
            <Link to="/signup">Sign up</Link>
          </Button>
        </div>
      )
    }
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-xs font-medium text-white/80">Guest</span>
        <Button
          asChild
          variant="secondary"
          size="sm"
          className="h-8 rounded-full border-0 bg-white/15 text-white hover:bg-white/25"
        >
          <Link to="/login">Sign in</Link>
        </Button>
        <Button
          asChild
          size="sm"
          className="h-8 rounded-full bg-white text-primary hover:bg-white/90"
        >
          <Link to="/signup">Sign up</Link>
        </Button>
      </div>
    )
  }

  const label = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email
  const isVisitor = user.role === 'visitor'

  if (onSurface) {
    return (
      <div className="flex max-w-[22rem] flex-wrap items-center justify-end gap-2">
        <span className="truncate text-sm font-semibold text-foreground" title={user.email}>
          {label}
        </span>
        {user.role ? (
          <span
            className="shrink-0 rounded border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
          >
            {user.role}
          </span>
        ) : null}
        <Button asChild variant="outline" size="sm" className="h-8 rounded-full">
          <Link to={isVisitor ? '/family' : '/municipality'}>
            {isVisitor ? 'Family' : 'Dashboard'}
          </Link>
        </Button>
        <Button type="button" variant="secondary" size="sm" className="h-8 rounded-full" onClick={() => logout()}>
          Log out
        </Button>
      </div>
    )
  }

  return (
    <div className="flex max-w-[22rem] flex-wrap items-center gap-2">
      <span className="truncate text-sm font-semibold text-white" title={user.email}>
        {label}
      </span>
      {user.role ? (
        <span
          className={cn(
            'shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
            'bg-white/20 text-white',
          )}
        >
          {user.role}
        </span>
      ) : null}
      <Button
        asChild
        variant="secondary"
        size="sm"
        className="h-8 rounded-full border border-white/40 bg-transparent text-white hover:bg-white/15"
      >
        <Link to={isVisitor ? '/family' : '/municipality'}>
          {isVisitor ? 'Family' : 'Dashboard'}
        </Link>
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-8 rounded-full border border-white/40 bg-transparent text-white hover:bg-white/15"
        onClick={() => logout()}
      >
        Log out
      </Button>
    </div>
  )
}
