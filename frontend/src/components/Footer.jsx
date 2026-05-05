import { Link } from 'react-router-dom';
import './Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-logo-wrap">
          <Link to="/" className="logo">SG AUTO TRADING</Link>
        </div>

        <p className="footer-commitment">
          Our Commitments: Quickness, Dependability, Excellence & Affordability. We engage in importing,
          distributing, purchasing and selling used imported vehicles with professional support.
        </p>

        <div className="footer-links">
          <Link to="/">HOME</Link>
          <Link to="/cars">STOCK</Link>
          <Link to="/tracking">TRACKING</Link>
          <Link to="/loan-calculator">LOAN CALCULATOR</Link>
          <Link to="/login">LOGIN</Link>
          <Link to="/signup">SIGN UP</Link>
        </div>
      </div>

      <p className="footer-bottom">&copy; 2026 SG AUTO TRADING All Rights Reserved</p>
    </footer>
  );
}

export default Footer;
