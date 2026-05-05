import { Link } from 'react-router-dom';
import './CarCard.css';

function CarCard({ car, detailLink }) {
  const defaultImage = 'https://images.unsplash.com/photo-1493238792000-8113da705763?auto=format&fit=crop&w=1000&q=80';
  const displayAuctionPrice = Number(car.starting_bid || 0);
  const displayPrice = Number(car.price || 0);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-MY', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div className="car-card">
      <div className="car-image">
        <img
          src={car.images && car.images[0] ? car.images[0] : defaultImage}
          alt={`${car.brand} ${car.model}`}
        />
        {car.status === 'auction' && (
          <span className="auction-badge">LIVE AUCTION</span>
        )}
      </div>

      <div className="car-info">
        <h3>{car.brand} {car.model}</h3>

        {car.status === 'auction' && (car.auction_end_time || car.auctionEnd) && (
          <p className="end-time">End At: {formatDate(car.auction_end_time || car.auctionEnd)}</p>
        )}

        <div className="car-details">
          <div className="detail-item">
            <span className="detail-label">Mileage</span>
            <span className="detail-value">{car.mileage.toLocaleString()} km</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Month/Year</span>
            <span className="detail-value">{car.year}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Color</span>
            <span className="detail-value">{car.color}</span>
          </div>
        </div>

        <div className="car-price">
          {car.status === 'auction' ? (
            <>
              <span className="label">Current Bid:</span>
              <span className="price">RM {displayAuctionPrice.toLocaleString()}</span>
            </>
          ) : (
            <span className="price">RM {displayPrice.toLocaleString()}</span>
          )}
        </div>

        <Link to={detailLink || `/cars/${car.id}`} className="btn-details">
          CLICK FOR MORE
        </Link>
      </div>
    </div>
  );
}

export default CarCard;
