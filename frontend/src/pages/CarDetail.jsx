import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import api, { getApiErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import './CarDetail.css';

function CarDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [car, setCar] = useState(null);
  const [bids, setBids] = useState([]);
  const [highestBid, setHighestBid] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [bidMessage, setBidMessage] = useState('');
  const [auctionView, setAuctionView] = useState(false);
  const [auctionEnabled, setAuctionEnabled] = useState(false);
  const [loanForm, setLoanForm] = useState({
    vehiclePrice: '',
    annualRate: '3.5',
    tenureYears: '5',
  });
  const [loanResult, setLoanResult] = useState(null);
  const [loanMessage, setLoanMessage] = useState('');

  const isAuctionEntry = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('entry') === 'auction';
  }, [location.search]);

  const fetchCarDetail = async () => {
    try {
      setLoading(true);
      const carResponse = await api.get(`/cars/${id}`, {
        params: { entry: isAuctionEntry ? 'auction' : 'sale' },
      });

      setCar(carResponse.data.car);
      setHighestBid(carResponse.data.highestBid);
      setAuctionEnabled(Boolean(carResponse.data?.auctionEnabled));
      setAuctionView(Boolean(carResponse.data?.auctionView));
      if (carResponse.data?.auctionView) {
        const bidsResponse = await api.get(`/bids/car/${id}`);
        setBids(bidsResponse.data.bids || []);
      } else {
        setBids([]);
      }
      setError('');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Failed to load vehicle details.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCarDetail();
  }, [id, isAuctionEntry]);

  useEffect(() => {
    if (!car?.auction_end_time) return undefined;

    const updateTimer = () => {
      const end = new Date(car.auction_end_time);
      const now = new Date();
      const diff = end - now;
      if (diff <= 0) {
        setTimeLeft('Auction Ended');
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${days}d ${hours}h ${minutes}m`);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 30000);
    return () => clearInterval(timer);
  }, [car?.auction_end_time]);

  const minBid = useMemo(() => {
    if (!car) return 0;
    if (highestBid) {
      return Number(highestBid) + 100;
    }
    return Number(car.starting_bid || 0);
  }, [car, highestBid]);

  const displayPrice = useMemo(() => {
    if (!car) return 0;
    if (car.status === 'auction' && auctionView) {
      return Number(highestBid || car.starting_bid || car.price || 0);
    }
    return Number(car.price || 0);
  }, [car, highestBid, auctionView]);

  useEffect(() => {
    if (!displayPrice) return;
    setLoanForm((previous) => ({
      ...previous,
      vehiclePrice: String(Math.round(displayPrice)),
    }));
  }, [displayPrice]);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const loanAmount = Number(loanForm.vehiclePrice);
      const annualRate = Number(loanForm.annualRate);
      const tenureMonths = Number(loanForm.tenureYears) * 12;

      if (!Number.isFinite(loanAmount) || loanAmount <= 0) {
        setLoanResult(null);
        return;
      }

      if (!Number.isFinite(annualRate) || annualRate < 0 || !Number.isFinite(tenureMonths) || tenureMonths <= 0) {
        return;
      }

      try {
        setLoanMessage('');
        const response = await api.post('/loan/calculate', {
          loanAmount,
          annualRate,
          tenureMonths,
        });
        setLoanResult(response.data);
      } catch {
        const monthlyRate = annualRate / 100 / 12;
        let monthlyPayment = 0;
        if (monthlyRate === 0) {
          monthlyPayment = loanAmount / tenureMonths;
        } else {
          monthlyPayment =
            (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths))) /
            (Math.pow(1 + monthlyRate, tenureMonths) - 1);
        }
        setLoanResult({
          monthlyPayment: Math.round(monthlyPayment * 100) / 100,
        });
        setLoanMessage('Using local estimate.');
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [loanForm]);

  const handleBid = async () => {
    if (!auctionEnabled || !auctionView || car?.status !== 'auction') {
      setBidMessage('Auction is unavailable for this vehicle.');
      return;
    }

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const amount = Number(bidAmount);
    if (!Number.isFinite(amount) || amount < minBid) {
      setBidMessage(`Bid must be at least RM ${minBid.toLocaleString()}`);
      return;
    }

    try {
      setBidLoading(true);
      setBidMessage('');
      await api.post('/bids', { car_id: Number(id), amount });
      setBidAmount('');
      setBidMessage('Bid placed successfully.');
      await fetchCarDetail();
    } catch (requestError) {
      setBidMessage(getApiErrorMessage(requestError, 'Failed to place bid.'));
    } finally {
      setBidLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="car-detail">
        <div className="container">
          <p className="subtitle">Loading vehicle details...</p>
        </div>
      </div>
    );
  }

  if (error || !car) {
    return (
      <div className="car-detail">
        <div className="container">
          <p className="subtitle" style={{ color: '#dc2626' }}>{error || 'Car not found.'}</p>
          <Link to="/cars" className="view-btn">Back to Stock</Link>
        </div>
      </div>
    );
  }

  const isAuctionEnded = car.auction_end_time ? new Date(car.auction_end_time) <= new Date() : false;
  const canBid = auctionEnabled && auctionView && car.status === 'auction' && !isAuctionEnded;
  const displayStatus = auctionView && car.status === 'auction' ? 'auction' : car.status === 'sold' ? 'sold' : 'available';
  const currentImage = car.images?.[activeImage] || car.images?.[0];

  const handleLoanChange = (event) => {
    const { name, value } = event.target;
    setLoanForm((previous) => ({ ...previous, [name]: value }));
  };

  return (
    <div className="car-detail-ref">
      <div className="container">
        <div className="detail-breadcrumb">
          <Link to="/">Home</Link> / <Link to="/cars">Stock</Link> / {car.brand} {car.model}
        </div>

        <div className="car-detail-grid">
          <section className="detail-left">
            <div className="detail-card gallery-card">
              <div className="detail-main-image">
              <img src={currentImage} alt={`${car.brand} ${car.model}`} />
              {auctionView && car.status === 'auction' && (
                  <span className="detail-badge">LIVE AUCTION</span>
              )}
            </div>
              <div className="detail-thumbnails">
                {(car.images || []).map((img, index) => (
                  <img
                    key={`${img}-${index}`}
                    src={img}
                    alt={`View ${index + 1}`}
                    className={activeImage === index ? 'active' : ''}
                    onClick={() => setActiveImage(index)}
                  />
                ))}
              </div>
            </div>

            <div className="detail-card">
              <h1 className="detail-title">{car.brand} {car.model}</h1>
              <div className="detail-spec-wrap">
                <div className="detail-spec-item">
                  <span>Years</span>
                  <strong>{car.year || '-'}</strong>
                </div>
                <div className="detail-spec-item">
                  <span>Transmission</span>
                  <strong>{car.transmission || '-'}</strong>
                </div>
                <div className="detail-spec-item">
                  <span>Mileage</span>
                  <strong>{Number(car.mileage || 0).toLocaleString()} km</strong>
                </div>
                <div className="detail-spec-item">
                  <span>Fuel</span>
                  <strong>{car.fuel_type || '-'}</strong>
                </div>
                <div className="detail-spec-item">
                  <span>Status</span>
                  <strong>{displayStatus}</strong>
                </div>
                <div className="detail-spec-item">
                  <span>Repair History</span>
                  <strong>{car.repaired === 'yes' ? 'Has Repair Record' : 'No Repair Record'}</strong>
                </div>
                <div className="detail-spec-item">
                  <span>Chassis No</span>
                  <strong>{car.chassis_no || `SGAT-${String(car.id).padStart(6, '0')}`}</strong>
                </div>
                <div className="detail-spec-item">
                  <span>Color</span>
                  <strong>{car.color || '-'}</strong>
                </div>
                <div className="detail-spec-item">
                  <span>CC</span>
                  <strong>{car.engine_cc ? `${car.engine_cc} CC` : '-'}</strong>
                </div>
              </div>
            </div>

            <div className="detail-card detail-description">
              <h3>Description</h3>
              <p>{car.description || 'No description provided.'}</p>
            </div>
          </section>

          <aside className="detail-right">
            <div className="detail-card side-card">
              <h3>{auctionView && car.status === 'auction' ? 'AUCTION DETAIL' : 'VEHICLE PRICE'}</h3>
              <div className="price-panel">
                <span className="price-label">{auctionView && car.status === 'auction' ? 'Current Bid' : 'Vehicle Price'}</span>
                <strong>RM {displayPrice.toLocaleString()}</strong>
              </div>
              {auctionView && car.status === 'auction' && (
                <div className="time-panel">
                  <span>Auction Ends In</span>
                  <strong>{timeLeft || '-'}</strong>
                </div>
              )}

              {auctionView && car.status === 'auction' && (
                <div className="detail-bid-form">
                <h3>Place Your Bid</h3>
                  <div className="bid-input-row">
                    <span className="currency">RM</span>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(event) => setBidAmount(event.target.value)}
                    placeholder={`Min: RM ${minBid.toLocaleString()}`}
                      className="bid-input"
                  />
                    <button onClick={handleBid} className="bid-btn" disabled={bidLoading || !canBid}>
                      {bidLoading ? 'Submitting...' : canBid ? 'Place Bid' : 'Auction Unavailable'}
                  </button>
                </div>
                {!isAuthenticated && <p className="login-hint">Please <Link to="/login">login</Link> to bid</p>}
                  {bidMessage && <p className="login-hint">{bidMessage}</p>}
                </div>
              )}
            </div>

            <div className="detail-card side-card">
              <h3>LOAN CALCULATION</h3>
              <div className="loan-fields">
                <label>Vehicle Price (RM)</label>
                <input
                  type="number"
                  name="vehiclePrice"
                  value={loanForm.vehiclePrice}
                  onChange={handleLoanChange}
                  min="0"
                />
                <label>Rates</label>
                <input
                  type="number"
                  name="annualRate"
                  value={loanForm.annualRate}
                  onChange={handleLoanChange}
                  min="0"
                  step="0.1"
                />
                <label>Repayment Period</label>
                <select name="tenureYears" value={loanForm.tenureYears} onChange={handleLoanChange}>
                  <option value="5">5 Years</option>
                  <option value="7">7 Years</option>
                  <option value="9">9 Years</option>
                </select>
              </div>
              <Link to="/loan-calculator" className="loan-check-btn">Check Now</Link>
              <div className="loan-estimate">
                RM {Number(loanResult?.monthlyPayment || 0).toLocaleString()}
              </div>
              <p className="loan-disclaimer">
                * Please use this calculator as a guide only. Results are approximate and may vary by bank policy.
              </p>
              {loanMessage && <p className="loan-message">{loanMessage}</p>}
            </div>

            {auctionView && car.status === 'auction' && (
              <div className="detail-card side-card">
                <h3>LATEST BIDS</h3>
                {bids.length === 0 ? (
                  <p className="empty-bids">No bids yet.</p>
                ) : (
                  <div className="bid-history">
                    {bids.slice(0, 5).map((bid) => (
                      <div className="bid-history-row" key={bid.id}>
                        <span>{bid.user?.name || 'Anonymous'}</span>
                        <strong>RM {Number(bid.amount).toLocaleString()}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </aside>
        </div>
      </div>
    </div>
  );
}

export default CarDetail;
