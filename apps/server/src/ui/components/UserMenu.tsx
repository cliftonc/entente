import { useAuth } from '../hooks/useAuth'

export default function UserMenu() {
  const { user, tenants, logout } = useAuth()

  if (!user) return null

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-circle avatar"
      >
        <div className="w-10 rounded-full">
          {user.avatarUrl ? (
            <img
              alt={user.name}
              src={user.avatarUrl}
            />
          ) : (
            <div className="bg-primary text-primary-content w-full h-full flex items-center justify-center text-sm font-medium">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
      <ul
        tabIndex={0}
        className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow"
      >
        <li className="menu-title">
          <span>{user.name}</span>
          <span className="text-xs opacity-60">@{user.username}</span>
        </li>
        <li><hr /></li>
        <li className="menu-title">
          <span>Teams ({tenants.length})</span>
        </li>
        {tenants.map((tenantUser) => (
          <li key={tenantUser.tenant.id}>
            <a className="text-sm">
              <span>{tenantUser.tenant.name}</span>
              <div className="badge badge-xs badge-ghost">
                {tenantUser.role}
              </div>
            </a>
          </li>
        ))}
        <li><hr /></li>
        <li>
          <button onClick={handleLogout} className="text-error">
            Logout
          </button>
        </li>
      </ul>
    </div>
  )
}