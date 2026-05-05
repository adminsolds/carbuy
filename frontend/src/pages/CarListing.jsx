import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CarCard from '../components/CarCard';
import api, { getApiErrorMessage } from '../lib/api';
import './CarListing.css';

function CarListing({ auctionMode = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cars, setCars] = useState([]);
  const [brands, setBrands] = useState(['All']);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [auctionEnabled, setAuctionEnabled] = useState(false);

  const selectedBrand = searchParams.get('brand') || 'All';
  const rawStatus = searchParams.get('status') || 'all';
  const selectedStatus = auctionMode ? 'auction' : (rawStatus === 'auction' ? 'all' : rawStatus);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const response = await api.get('/cars/brands', {
          params: { entry: auctionMode ? 'auction' : 'sale' },
        });
        setBrands(['All', ...(response.data.brands || [])]);
      } catch {
        setBrands(['All']);
      }
    };

    fetchBrands();
  }, []);

  useEffect(() => {
    const fetchCars = async () => {
      try {
        setLoading(true);
        setError('');
        const params = { limit: 80, entry: auctionMode ? 'auction' : 'sale' };
        if (selectedBrand !== 'All') params.brand = selectedBrand;
        if (searchTerm.trim()) params.search = searchTerm.trim();
        if (!auctionMode && selectedStatus !== 'all') params.status = selectedStatus;
        if (auctionMode) params.status = 'auction';

        const response = await api.get('/cars', { params });
        setCars(response.data.cars || []);
        setAuctionEnabled(Boolean(response.data?.auctionEnabled));
      } catch (requestError) {
        setError(getApiErrorMessage(requestError, 'Failed to load vehicles.'));
        setCars([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCars();
  }, [auctionMode, selectedBrand, selectedStatus, searchTerm]);

  const handleBrandChange = (brand) => {
    const next = {};
    if (selectedStatus !== 'all') next.status = selectedStatus;
    if (brand !== 'All') next.brand = brand;
    setSearchParams(next);
  };

  const handleStatusChange = (status) => {
    if (auctionMode) return;
    const next = {};
    if (selectedBrand !== 'All') next.brand = selectedBrand;
    if (status !== 'all') next.status = status;
    setSearchParams(next);
  };

  return (
    <div className="car-listing">
      <div className="container">
        <p className="listing-kicker">SG Style Stock</p>
        <h1>{auctionMode ? 'Our Auction Vehicles' : 'Our Stock'}</h1>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by brand or model..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="search-input"
          />
        </div>

        {!auctionMode && (
          <div className="status-filter">
            <button
              className={`status-btn ${selectedStatus === 'all' ? 'active' : ''}`}
              onClick={() => handleStatusChange('all')}
            >
              All Vehicles
            </button>
            <button
              className={`status-btn ${selectedStatus === 'available' ? 'active' : ''}`}
              onClick={() => handleStatusChange('available')}
            >
              Latest Deals
            </button>
            <button
              className={`status-btn ${selectedStatus === 'sold' ? 'active' : ''}`}
              onClick={() => handleStatusChange('sold')}
            >
              Sold
            </button>
          </div>
        )}

        <div className="brand-filter">
          {brands.map((brand) => (
            <button
              key={brand}
              className={`filter-btn ${selectedBrand === brand ? 'active' : ''}`}
              onClick={() => handleBrandChange(brand)}
            >
              {brand}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="results-count">Loading vehicles...</p>
        ) : (
          <p className="results-count">{cars.length} vehicles found</p>
        )}

        {error && <p className="results-count" style={{ color: '#dc2626' }}>{error}</p>}

        {auctionMode && !auctionEnabled && !loading && (
          <p className="results-count">No auction vehicles at the moment, stay tuned!</p>
        )}

        <div className="cars-grid">
          {cars.map((car) => (
            <CarCard
              key={car.id}
              car={car}
              detailLink={auctionMode ? `/cars/${car.id}?entry=auction` : `/cars/${car.id}`}
            />
          ))}
        </div>

        {!loading && cars.length === 0 && (
          <div className="no-results">
            <p>
              {auctionMode
                ? 'No auction vehicles at the moment, stay tuned!'
                : 'No vehicles found matching your criteria.'}
            </p>
            <button onClick={() => { setSearchParams({}); setSearchTerm(''); }} className="reset-btn">
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CarListing;
