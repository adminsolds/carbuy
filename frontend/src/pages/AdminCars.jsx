import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { getApiErrorMessage } from '../lib/api';
import './AdminCars.css';

const defaultForm = {
  brand: '',
  model: '',
  year: '',
  mileage: '',
  color: '',
  price: '',
  description: '',
  status: 'available',
  starting_bid: '',
  auction_end_time: '',
  imagesText: '',
  // New fields
  transmission: '',
  fuel_type: '',
  engine_cc: '',
  chassis_no: '',
  registration_expiry: '',
  owners_count: '',
  road_tax_expire: '',
};

function AdminCars() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [cars, setCars] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [auctionEnabled, setAuctionEnabled] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [stats, setStats] = useState({ total: 0, available: 0, auction: 0, sold: 0 });
  const [filter, setFilter] = useState({
    search: '',
    status: 'all',
    min_price: '',
    max_price: '',
    min_year: '',
    max_year: '',
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    page: 1,
    pageSize: 10,
  });

  const canManageCars = ['seller', 'agent'].includes(user?.role);
  const canManageSettings = user?.role === 'seller';

  const pageTitle = useMemo(
    () => (editingId ? `Edit Car #${editingId}` : 'Create New Car'),
    [editingId]
  );

  const totalPages = Math.max(1, Math.ceil(total / filter.pageSize));

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/stats');
      setStats({
        total: response.stats?.cars?.total || 0,
        available: response.stats?.cars?.available || 0,
        auction: response.stats?.cars?.auction || 0,
        sold: response.stats?.cars?.sold || 0,
      });
    } catch {
      // Non-critical, keep existing stats
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings');
      setAuctionEnabled(Boolean(response.data?.auctionEnabled));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Failed to load system settings.'));
    }
  };

  const fetchCars = async (nextFilter = filter) => {
    try {
      setLoading(true);
      const params = {
        limit: nextFilter.pageSize,
        offset: (nextFilter.page - 1) * nextFilter.pageSize,
        sortBy: nextFilter.sortBy,
        sortOrder: nextFilter.sortOrder,
        includeAuction: '1',
      };
      if (nextFilter.search.trim()) params.search = nextFilter.search.trim();
      if (nextFilter.status !== 'all') params.status = nextFilter.status;
      if (nextFilter.min_price) params.min_price = nextFilter.min_price;
      if (nextFilter.max_price) params.max_price = nextFilter.max_price;
      if (nextFilter.min_year) params.min_year = nextFilter.min_year;
      if (nextFilter.max_year) params.max_year = nextFilter.max_year;

      const response = await api.get('/cars', { params });
      setCars(response.data?.cars || []);
      setTotal(Number(response.data?.total || 0));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Failed to load vehicles.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!canManageCars) return;
    if (canManageSettings) {
      fetchStats();
      fetchSettings();
    }
  }, [isAuthenticated, canManageCars, canManageSettings, navigate]);

  useEffect(() => {
    if (!canManageCars) return;
    fetchCars();
  }, [canManageCars, filter.page, filter.pageSize, filter.status, filter.sortBy, filter.sortOrder, filter.search, filter.min_price, filter.max_price, filter.min_year, filter.max_year]);

  const handleToggleAuction = async () => {
    try {
      setSettingsLoading(true);
      setSettingsMessage('');
      const response = await api.put('/settings/auction-enabled', { enabled: !auctionEnabled });
      setAuctionEnabled(Boolean(response.data?.auctionEnabled));
      setSettingsMessage(response.data?.auctionEnabled ? 'Auction has been enabled.' : 'Auction has been disabled.');
    } catch (requestError) {
      setSettingsMessage(getApiErrorMessage(requestError, 'Failed to update auction setting.'));
    } finally {
      setSettingsLoading(false);
    }
  };

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onFilterChange = (event) => {
    const { name, value } = event.target;
    setFilter((prev) => ({ ...prev, [name]: value, page: 1 }));
  };

  const onSearch = async (event) => {
    event.preventDefault();
    await fetchCars({ ...filter, page: 1 });
    setFilter((prev) => ({ ...prev, page: 1 }));
  };

  const resetForm = () => {
    setForm(defaultForm);
    setEditingId(null);
  };

  const toPayload = () => {
    const imageUrls = form.imagesText
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);

    const payload = {
      brand: form.brand.trim(),
      model: form.model.trim(),
      year: Number(form.year),
      mileage: Number(form.mileage),
      color: form.color.trim() || null,
      price: Number(form.price),
      description: form.description.trim() || null,
      status: form.status,
      images: imageUrls,
    };

    // New fields
    if (form.transmission.trim()) payload.transmission = form.transmission.trim();
    if (form.fuel_type.trim()) payload.fuel_type = form.fuel_type.trim();
    if (form.engine_cc) payload.engine_cc = Number(form.engine_cc);
    if (form.chassis_no.trim()) payload.chassis_no = form.chassis_no.trim();
    if (form.registration_expiry) payload.registration_expiry = form.registration_expiry;
    if (form.owners_count) payload.owners_count = Number(form.owners_count);
    if (form.road_tax_expire) payload.road_tax_expire = form.road_tax_expire;

    if (form.status === 'auction') {
      payload.starting_bid = Number(form.starting_bid || 0);
      payload.auction_end_time = form.auction_end_time || null;
    }

    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      setSubmitting(true);
      const payload = toPayload();
      if (editingId) {
        await api.put(`/cars/${editingId}`, payload);
        setMessage(`Car #${editingId} updated successfully.`);
      } else {
        const response = await api.post('/cars', payload);
        setMessage(`Car #${response.data.car.id} created successfully.`);
      }
      resetForm();
      await fetchCars();
      await fetchStats();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Failed to save vehicle.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (car) => {
    setEditingId(car.id);
    setForm({
      brand: car.brand || '',
      model: car.model || '',
      year: String(car.year || ''),
      mileage: String(car.mileage || ''),
      color: car.color || '',
      price: String(car.price || ''),
      description: car.description || '',
      status: car.status || 'available',
      starting_bid: String(car.starting_bid || ''),
      auction_end_time: car.auction_end_time ? car.auction_end_time.slice(0, 16) : '',
      imagesText: Array.isArray(car.images) ? car.images.join('\n') : '',
      transmission: car.transmission || '',
      fuel_type: car.fuel_type || '',
      engine_cc: car.engine_cc ? String(car.engine_cc) : '',
      chassis_no: car.chassis_no || '',
      registration_expiry: car.registration_expiry || '',
      owners_count: car.owners_count ? String(car.owners_count) : '',
      road_tax_expire: car.road_tax_expire || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (carId) => {
    if (!window.confirm(`Delete car #${carId}? This action cannot be undone.`)) return;
    setMessage('');
    setError('');

    try {
      await api.delete(`/cars/${carId}`);
      setMessage(`Car #${carId} deleted successfully.`);
      await fetchCars();
      await fetchStats();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Failed to delete vehicle.'));
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

  if (!canManageCars) {
    return (
      <div className="admin-cars-page">
        <div className="container">
          <div className="admin-panel">
            <h1>Access Denied</h1>
            <p className="admin-muted">Only seller/agent accounts can manage cars.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-cars-page">
      <div className="container">
        <h1 className="admin-heading">Manage Cars</h1>
        <p className="admin-muted">Create, update, delete and browse your vehicle listings.</p>

        {canManageSettings && (
        <div className="admin-panel">
          <h2>Dashboard</h2>
          <div className="admin-library-stats">
            <div><span>Total</span><strong>{stats.total}</strong></div>
            <div><span>Available</span><strong>{stats.available}</strong></div>
            <div><span>Auction</span><strong>{stats.auction}</strong></div>
            <div><span>Sold</span><strong>{stats.sold}</strong></div>
          </div>
        </div>
        )}

        {canManageSettings && (
        <div className="admin-panel admin-settings-panel">
          <h2>Auction Control</h2>
          <p className="admin-muted">
            Current status: <strong>{auctionEnabled ? 'Enabled' : 'Disabled'}</strong>
          </p>
          <div className="admin-settings-actions">
            <button type="button" onClick={handleToggleAuction} disabled={settingsLoading}>
              {settingsLoading ? 'Saving...' : auctionEnabled ? 'Disable Auction' : 'Enable Auction'}
            </button>
            {settingsMessage && <span className="admin-settings-msg">{settingsMessage}</span>}
          </div>
        </div>
        )}

        <form className="admin-panel" onSubmit={handleSubmit}>
          <h2>{pageTitle}</h2>

          <div className="admin-grid">
            <input name="brand" value={form.brand} onChange={onChange} placeholder="Brand *" required />
            <input name="model" value={form.model} onChange={onChange} placeholder="Model *" required />
            <input name="year" type="number" value={form.year} onChange={onChange} placeholder="Year *" required />
            <input name="mileage" type="number" value={form.mileage} onChange={onChange} placeholder="Mileage (km) *" required />
            <input name="color" value={form.color} onChange={onChange} placeholder="Color" />
            <input name="price" type="number" value={form.price} onChange={onChange} placeholder="Price (RM) *" required />
            <select name="status" value={form.status} onChange={onChange}>
              <option value="available">Available</option>
              <option value="auction">Auction</option>
              <option value="sold">Sold</option>
            </select>
            <input name="transmission" value={form.transmission} onChange={onChange} placeholder="Transmission (e.g. Auto)" />
            <input name="fuel_type" value={form.fuel_type} onChange={onChange} placeholder="Fuel Type (e.g. Petrol)" />
            <input name="engine_cc" type="number" value={form.engine_cc} onChange={onChange} placeholder="Engine CC" />
            <input name="chassis_no" value={form.chassis_no} onChange={onChange} placeholder="Chassis No" />
            <input name="owners_count" type="number" value={form.owners_count} onChange={onChange} placeholder="Previous Owners" />
            <input name="registration_expiry" type="date" value={form.registration_expiry} onChange={onChange} placeholder="Registration Expiry" />
            <input name="road_tax_expire" type="date" value={form.road_tax_expire} onChange={onChange} placeholder="Road Tax Expires" />
            {form.status === 'auction' && (
              <>
                <input
                  name="starting_bid"
                  type="number"
                  value={form.starting_bid}
                  onChange={onChange}
                  placeholder="Starting Bid (RM)"
                />
                <input
                  name="auction_end_time"
                  type="datetime-local"
                  value={form.auction_end_time}
                  onChange={onChange}
                />
              </>
            )}
          </div>

          <textarea
            name="description"
            value={form.description}
            onChange={onChange}
            placeholder="Description"
            rows={3}
          />

          <textarea
            name="imagesText"
            value={form.imagesText}
            onChange={onChange}
            placeholder="Image URLs (comma or newline separated)"
            rows={3}
          />

          {error && <p className="admin-error">{error}</p>}
          {message && <p className="admin-success">{message}</p>}

          <div className="admin-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editingId ? 'Update Car' : 'Create Car'}
            </button>
            {editingId && (
              <button type="button" className="secondary" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        <div className="admin-panel">
          <h2>Current Vehicles</h2>

          <form className="admin-toolbar" onSubmit={onSearch}>
            <input
              name="search"
              value={filter.search}
              onChange={onFilterChange}
              placeholder="Search brand or model"
            />
            <select name="status" value={filter.status} onChange={onFilterChange}>
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="auction">Auction</option>
              <option value="sold">Sold</option>
            </select>
            <input
              name="min_price"
              type="number"
              value={filter.min_price}
              onChange={onFilterChange}
              placeholder="Min Price"
            />
            <input
              name="max_price"
              type="number"
              value={filter.max_price}
              onChange={onFilterChange}
              placeholder="Max Price"
            />
            <input
              name="min_year"
              type="number"
              value={filter.min_year}
              onChange={onFilterChange}
              placeholder="From Year"
            />
            <input
              name="max_year"
              type="number"
              value={filter.max_year}
              onChange={onFilterChange}
              placeholder="To Year"
            />
            <select name="sortBy" value={filter.sortBy} onChange={onFilterChange}>
              <option value="createdAt">Newest</option>
              <option value="price">Price</option>
              <option value="year">Year</option>
              <option value="mileage">Mileage</option>
              <option value="brand">Brand</option>
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
            <p className="admin-muted">Loading vehicles...</p>
          ) : cars.length === 0 ? (
            <p className="admin-muted">No vehicles found.</p>
          ) : (
            <div className="admin-list">
              {cars.map((car) => (
                <div className="admin-car-row" key={car.id}>
                  <div>
                    <strong>#{car.id} {car.brand} {car.model}</strong>
                    <p>
                      {car.year} · {Number(car.mileage || 0).toLocaleString()} km · {car.status} · RM {Number(car.price || 0).toLocaleString()}
                      {car.transmission ? ` · ${car.transmission}` : ''}
                      {car.fuel_type ? ` · ${car.fuel_type}` : ''}
                    </p>
                  </div>
                  <div className="admin-row-actions">
                    <button type="button" onClick={() => handleEdit(car)}>Edit</button>
                    {user?.role === 'seller' && (
                      <button type="button" className="danger" onClick={() => handleDelete(car.id)}>Delete</button>
                    )}
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

export default AdminCars;
