import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { getApiErrorMessage } from '../lib/api';
import './AdminCars.css';

function AdminUsers() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ total: 0, buyers: 0, sellers: 0, agents: 0 });
  const [filter, setFilter] = useState({
    search: '',
    role: 'all',
    is_active: 'all',
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    page: 1,
    pageSize: 10,
  });

  const isSeller = user?.role === 'seller';
  const totalPages = Math.max(1, Math.ceil(total / filter.pageSize));

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/stats');
      setStats({
        total: response.stats?.users?.total || 0,
        buyers: response.stats?.users?.buyers || 0,
        sellers: response.stats?.users?.sellers || 0,
        agents: response.stats?.users?.agents || 0,
      });
    } catch {
      // Non-critical
    }
  };

  const fetchUsers = async (next = filter) => {
    try {
      setLoading(true);
      const params = {
        limit: next.pageSize,
        offset: (next.page - 1) * next.pageSize,
        sortBy: next.sortBy,
        sortOrder: next.sortOrder,
      };
      if (next.search.trim()) params.search = next.search.trim();
      if (next.role !== 'all') params.role = next.role;
      if (next.is_active !== 'all') params.is_active = next.is_active;

      const response = await api.get('/admin/users', { params });
      setUsers(response.data?.users || []);
      setTotal(Number(response.data?.total || 0));
      setError('');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Failed to load users.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!isSeller) return;
    fetchStats();
  }, [isAuthenticated, isSeller, navigate]);

  useEffect(() => {
    if (!isSeller) return;
    fetchUsers();
  }, [isSeller, filter.page, filter.pageSize, filter.sortBy, filter.sortOrder, filter.role, filter.is_active, filter.search]);

  const onFilterChange = (event) => {
    const { name, value } = event.target;
    setFilter((prev) => ({ ...prev, [name]: value, page: 1 }));
  };

  const onSearch = async (event) => {
    event.preventDefault();
    await fetchUsers({ ...filter, page: 1 });
    setFilter((prev) => ({ ...prev, page: 1 }));
  };

  const updateRole = async (targetUser, nextRole) => {
    try {
      setMessage('');
      setError('');
      await api.put(`/admin/users/${targetUser.id}/role`, { role: nextRole });
      setMessage(`User #${targetUser.id} role updated to ${nextRole}.`);
      await fetchUsers();
      await fetchStats();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Failed to update user role.'));
    }
  };

  const toggleActive = async (targetUser) => {
    const nextActive = !targetUser.is_active;
    try {
      setMessage('');
      setError('');
      await api.put(`/admin/users/${targetUser.id}/active`, { is_active: nextActive });
      setMessage(`User #${targetUser.id} ${nextActive ? 'activated' : 'deactivated'}.`);
      await fetchUsers();
      await fetchStats();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Failed to update user status.'));
    }
  };

  const deleteUser = async (targetUser) => {
    const confirmed = window.confirm(`Delete user #${targetUser.id} (${targetUser.email})?`);
    if (!confirmed) return;
    try {
      setMessage('');
      setError('');
      await api.delete(`/admin/users/${targetUser.id}`);
      setMessage(`User #${targetUser.id} deleted successfully.`);
      await fetchUsers();
      await fetchStats();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Failed to delete user.'));
    }
  };

  const goPrev = () => {
    if (filter.page <= 1) return;
    setFilter((prev) => ({ ...prev, page: prev.page - 1 }));
  };

  const goNext = () => {
    if (filter.page >= totalPages) return;
    setFilter((prev) => ({ ...prev, page: prev.page + 1 }));
  };

  if (!isAuthenticated) return null;

  if (!isSeller) {
    return (
      <div className="admin-cars-page">
        <div className="container">
          <div className="admin-panel">
            <h1>Access Denied</h1>
            <p className="admin-muted">Only seller accounts can manage users.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-cars-page">
      <div className="container">
        <h1 className="admin-heading">Registered User Management</h1>
        <p className="admin-muted">Browse, update role, activate/deactivate, and remove registered users.</p>

        <div className="admin-panel">
          <h2>User Statistics</h2>
          <div className="admin-library-stats">
            <div><span>Total</span><strong>{stats.total}</strong></div>
            <div><span>Buyers</span><strong>{stats.buyers}</strong></div>
            <div><span>Sellers</span><strong>{stats.sellers}</strong></div>
            <div><span>Agents</span><strong>{stats.agents}</strong></div>
            <div><span>Active</span><strong>{users.filter(u => u.is_active).length}</strong></div>
          </div>
        </div>

        <div className="admin-panel">
          <h2>All Users</h2>

          {error && <p className="admin-error">{error}</p>}
          {message && <p className="admin-success">{message}</p>}

          <form className="admin-toolbar" onSubmit={onSearch}>
            <input
              name="search"
              value={filter.search}
              onChange={onFilterChange}
              placeholder="Search name, email, phone"
            />
            <select name="role" value={filter.role} onChange={onFilterChange}>
              <option value="all">All Roles</option>
              <option value="buyer">User</option>
              <option value="seller">Admin</option>
              <option value="agent">Agent</option>
            </select>
            <select name="is_active" value={filter.is_active} onChange={onFilterChange}>
              <option value="all">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <select name="sortBy" value={filter.sortBy} onChange={onFilterChange}>
              <option value="createdAt">Newest</option>
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="role">Role</option>
            </select>
            <select name="sortOrder" value={filter.sortOrder} onChange={onFilterChange}>
              <option value="DESC">Desc</option>
              <option value="ASC">Asc</option>
            </select>
            <select name="pageSize" value={filter.pageSize} onChange={onFilterChange}>
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
              <option value="50">50 / page</option>
            </select>
            <button type="submit">Apply</button>
          </form>

          {loading ? (
            <p className="admin-muted">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="admin-muted">No users found.</p>
          ) : (
            <div className="admin-list">
              {users.map((item) => (
                <div className="admin-car-row" key={item.id}>
                  <div>
                    <strong>#{item.id} {item.name || '-'}</strong>
                    <p>
                      {item.email || '-'} · {item.phone || '-'}{' '}
                      <span className={`role-badge role-${item.role}`}>{item.role === 'seller' ? 'Admin' : item.role === 'buyer' ? 'User' : 'Agent'}</span>{' '}
                      <span className={`status-badge status-${item.is_active ? 'active' : 'inactive'}`}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </p>
                    {item.gender && <p>Gender: {item.gender}</p>}
                    {item.company_name && <p>Company: {item.company_name}{item.company_phone ? ` · ${item.company_phone}` : ''}</p>}
                    {(item.address_city || item.address_state) && (
                      <p>Location: {[item.address_city, item.address_state].filter(Boolean).join(', ')}</p>
                    )}
                    <p className="admin-muted" style={{ fontSize: '11px' }}>
                      Joined: {new Date(item.createdAt).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div className="admin-row-actions">
                    <button type="button" onClick={() => updateRole(item, 'buyer')}>
                      Set Buyer
                    </button>
                    <button type="button" onClick={() => updateRole(item, 'agent')}>
                      Set Agent
                    </button>
                    <button type="button" onClick={() => updateRole(item, 'seller')}>
                      Set Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(item)}
                      className={item.is_active ? 'secondary' : ''}
                    >
                      {item.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" className="danger" onClick={() => deleteUser(item)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="admin-pager">
            <button type="button" onClick={goPrev} disabled={filter.page <= 1}>Prev</button>
            <span>Page {filter.page} / {totalPages} · Total {total}</span>
            <button type="button" onClick={goNext} disabled={filter.page >= totalPages}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminUsers;
