import { useState } from 'react'
import { Link } from 'react-router-dom'

function PersonAvatar({ person, compact }) {
  const [failed, setFailed] = useState(false)
  const name = person.display_name || person.username
  return (
    <span aria-hidden="true" className={`dashboard-avatar overflow-hidden ${compact ? 'h-14 w-14 text-lg' : 'h-16 w-16 text-xl'} transition-transform group-hover:scale-105 motion-reduce:transform-none`}>
      {person.avatar_url && !failed ? (
        <img src={person.avatar_url} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : name?.charAt(0).toUpperCase()}
    </span>
  )
}

export default function SearchPeople({ users, compact = false, onNavigate }) {
  return (
    <ul className={compact ? 'flex gap-2 overflow-x-auto px-1 py-2' : 'flex gap-3 overflow-x-auto py-2 sm:flex-wrap sm:gap-5 sm:overflow-visible'}>
      {users.map((person) => (
        <li key={person.id} className={compact ? 'w-24 shrink-0' : 'w-28 shrink-0'}>
          <Link
            to={`/u/${person.id}`}
            onClick={onNavigate}
            className="group flex min-w-0 flex-col items-center gap-2 rounded-xl px-2 py-3 text-center text-[var(--studio-text)] transition-colors hover:bg-[var(--studio-control-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--studio-accent)]"
          >
            <PersonAvatar key={person.avatar_url} person={person} compact={compact} />
            <span className="w-full truncate text-sm font-semibold" title={person.display_name || person.username}>
              {person.display_name || person.username}
            </span>
            {!compact && <span className="-mt-1 w-full truncate text-xs text-[var(--studio-text-muted)]" title={`@${person.username}`}>@{person.username}</span>}
          </Link>
        </li>
      ))}
    </ul>
  )
}
