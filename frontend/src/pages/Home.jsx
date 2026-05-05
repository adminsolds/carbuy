import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import './Home.css';

const processSteps = [
  { title: 'Choose Your Vehicle', description: 'Explore the variety of vehicles listed on our website.', icon: '🚗' },
  { title: 'Sign Up', description: 'Join as a user, complete your profile and verify your email.', icon: '📝' },
  { title: 'Condition Inspection', description: 'Inspect the condition of the vehicle at the storeyard.', icon: '🔍' },
  { title: 'Top Up Credits', description: 'Add bidding credits through online banking before auction.', icon: '💳' },
  { title: 'Live Auction', description: 'Join live bidding and place your best offer in real-time.', icon: '⚡' },
];

const faqs = [
  {
    question: 'How can I participate in the auto vehicle auction?',
    answer:
      'Step 1: Register as a user. Step 2: Select a vehicle. Step 3: Inspect vehicle condition. Step 4: Complete bidder registration. Step 5: Join live auction.',
  },
  {
    question: "Where can I inspect the vehicle's condition?",
    answer:
      'You can view vehicles at our store yard on the listed date and time. Please make an appointment before visiting.',
  },
  {
    question: 'Where does the bidding take place?',
    answer: 'Bidding takes place online through our platform.',
  },
  {
    question: 'What documents are required for registration?',
    answer: 'Prepare your ID card copies (front and back) and complete your profile details.',
  },
];

const fallbackCars = [
  { id: 1, brand: 'BMW', model: '320i Sport', year: 2021, mileage: 25000, color: 'White', price: 185000, status: 'available', images: ['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1000&q=80'] },
  { id: 2, brand: 'Mercedes-Benz', model: 'C200 AMG', year: 2022, mileage: 15000, color: 'Black', price: 220000, status: 'available', images: ['https://images.unsplash.com/photo-1617458047302-4f8eaaf1941a?auto=format&fit=crop&w=1000&q=80'] },
  { id: 3, brand: 'Toyota', model: 'Camry Hybrid', year: 2023, mileage: 8000, color: 'Silver', price: 145000, status: 'available', images: ['https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1000&q=80'] },
];

function Home() {
  const [saleCars, setSaleCars] = useState(fallbackCars);
  const [auctionCars, setAuctionCars] = useState([]);
  const [auctionEnabled, setAuctionEnabled] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    const fetchCars = async () => {
      try {
        const [saleResponse, auctionResponse] = await Promise.all([
          api.get('/cars', { params: { limit: 60, entry: 'sale' } }),
          api.get('/cars', { params: { limit: 60, entry: 'auction' } }),
        ]);
        const saleData = saleResponse.data?.cars || [];
        const auctionData = auctionResponse.data?.cars || [];

        setAuctionEnabled(Boolean(auctionResponse.data?.auctionEnabled));
        if (saleData.length > 0) {
          setSaleCars(saleData);
        } else {
          setSaleCars([]);
        }
        setAuctionCars(auctionData);
      } catch {
        setSaleCars(fallbackCars);
        setAuctionCars([]);
        setAuctionEnabled(false);
      }
    };

    fetchCars();
  }, []);

  const brands = useMemo(
    () => [...new Set(saleCars.map((car) => car.brand))].sort((a, b) => a.localeCompare(b)),
    [saleCars]
  );

  const applySearch = () => {
    const min = Number(minPrice) || 0;
    const max = Number(maxPrice) || Number.MAX_SAFE_INTEGER;

    const filtered = saleCars.filter((car) => {
      const passBrand = selectedBrand ? car.brand === selectedBrand : true;
      const currentPrice = Number(car.price || 0);
      return passBrand && currentPrice >= min && currentPrice <= max;
    });

    setSearchResults(filtered);
    setHasSearched(true);
  };

  const formatPrice = (value) => `RM ${Number(value || 0).toLocaleString()}`;
  const formatAuctionEnd = (value) =>
    value ? new Date(value).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }) : '';

  const carCard = (car, options = {}) => (
    <article className="landing-car-card" key={car.id}>
      <img
        src={car.images?.[0] || fallbackCars[0].images[0]}
        alt={`${car.brand} ${car.model}`}
        className="landing-car-image"
      />
      <div className="landing-car-content">
        <h3>{car.brand} {car.model}</h3>
        {options.auction && <p className="auction-end">End At: {formatAuctionEnd(car.auction_end_time)}</p>}
        <div className="car-meta">
          <span>Mileage: {Number(car.mileage || 0).toLocaleString()} km</span>
          <span>Month/Year: {car.year || '-'}</span>
          <span>Color: {car.color || '-'}</span>
        </div>
        <div className="price-row">
          <span className="price">{formatPrice(options.auction ? car.starting_bid : car.price)}</span>
          <Link to={options.auction ? `/cars/${car.id}?entry=auction` : `/cars/${car.id}`}>CLICK FOR MORE</Link>
        </div>
      </div>
    </article>
  );

  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div className="hero-overlay" />
        <div className="container hero-inner">
          <p className="hero-kicker">Trusted Used Car Marketplace</p>
          <h1>Your Dream Car Here</h1>
          <p>Find quality pre-owned vehicles, live bidding opportunities, and great latest deals in one place.</p>
          <Link to="/cars" className="hero-btn">Browse Stock</Link>
        </div>
      </section>

      <section className="landing-section">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <div className="step-grid">
            {processSteps.map((step) => (
              <div className="step-card" key={step.title}>
                <span className="step-icon">{step.icon}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section section-gray">
        <div className="container">
          <div className="search-panel">
            <img
              src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1100&q=80"
              alt="Search cars"
            />
            <div className="search-form">
              <h2>Search Your Dream Car Here</h2>
              <select value={selectedBrand} onChange={(event) => setSelectedBrand(event.target.value)}>
                <option value="">Select Brand</option>
                {brands.map((brand) => (
                  <option value={brand} key={brand}>{brand}</option>
                ))}
              </select>
              <div className="search-input-row">
                <input type="number" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="Min Price" />
                <input type="number" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Max Price" />
              </div>
              <button type="button" onClick={applySearch}>SEARCH</button>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="container">
          <h2 className="section-title">Explore Car By Brand</h2>
          <div className="brand-grid">
            {brands.map((brand) => (
              <button type="button" key={brand} onClick={() => setSelectedBrand(brand)}>
                {brand}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="container">
          <h2 className="section-title">Searched Results</h2>
          <div className="car-grid">
            {hasSearched ? (
              searchResults.length ? searchResults.slice(0, 6).map(carCard) : <p>No vehicles found.</p>
            ) : (
              <p>Please apply search filters to view results.</p>
            )}
          </div>
        </div>
      </section>

      <section className="landing-section section-gray">
        <div className="container">
          <h2 className="section-title">Our Bidding List</h2>
          {auctionEnabled && auctionCars.length > 0 ? (
            <>
              <div className="car-grid">
                {auctionCars.slice(0, 6).map((car) => carCard(car, { auction: true }))}
              </div>
              <div style={{ textAlign: 'center', marginTop: '18px' }}>
                <Link to="/auction" className="hero-btn">Browse Auction Vehicles</Link>
              </div>
            </>
          ) : (
            <p className="auction-empty">No auction vehicles at the moment, stay tuned!</p>
          )}
        </div>
      </section>

      <section className="landing-section">
        <div className="container">
          <h2 className="section-title">Our Latest Deals</h2>
          <div className="car-grid">
            {saleCars.filter((car) => car.status === 'available').slice(0, 6).map((car) => carCard(car))}
          </div>
        </div>
      </section>

      <section className="landing-section section-gray">
        <div className="container about-grid">
          <div>
            <h2 className="section-title align-left">SG AUTO TRADING Inspired Experience</h2>
            <p>
              We built this used car page with the same structure and interaction flow as the referenced site:
              clear onboarding steps, quick search, brand exploration, live bidding list, and latest deals.
            </p>
            <p>
              Buying or selling is simple with transparent vehicle information and direct access to stock details.
            </p>
          </div>
          <div className="register-card">
            <h3>Register Now</h3>
            <p>Check our FAQ and start bidding on your preferred vehicles today.</p>
            <Link to="/signup">Create Account</Link>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="container">
          <h2 className="section-title">Frequently Ask Question</h2>
          <div className="faq-list">
            {faqs.map((faq, index) => (
              <div className="faq-item" key={faq.question}>
                <button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)}>
                  {faq.question}
                </button>
                {openFaq === index && <p>{faq.answer}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
