import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Header.css';

function Header() {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
    navigate('/');
  };

  return (
    <header className="header">
      <div className="container">
        <Link to="/" className="logo">SG AUTO TRADING</Link>

        <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <span></span>
          <span></span>
          <span></span>
        </button>

        <nav className={`nav ${isMenuOpen ? 'active' : ''}`}>
          <NavLink to="/" onClick={() => setIsMenuOpen(false)}>HOME</NavLink>
          <NavLink to="/cars" onClick={() => setIsMenuOpen(false)}>STOCK</NavLink>
          <NavLink to="/auction" onClick={() => setIsMenuOpen(false)}>AUCTION</NavLink>
          <NavLink to="/loan-calculator" onClick={() => setIsMenuOpen(false)}>LOAN CALCULATOR</NavLink>
          <NavLink to="/tracking" onClick={() => setIsMenuOpen(false)}>TRACKING</NavLink>
          <NavLink to="/agent" onClick={() => setIsMenuOpen(false)}>AGENT</NavLink>
          {user?.role === 'seller' && (
            <>
              <NavLink to="/admin/cars" onClick={() => setIsMenuOpen(false)}>MANAGE CARS</NavLink>
              <NavLink to="/admin/users" onClick={() => setIsMenuOpen(false)}>MANAGE USERS</NavLink>
            </>
          )}

          {isAuthenticated ? (
            <button onClick={handleLogout} className="btn-logout">LOGOUT</button>
          ) : (
            <>
              <NavLink to="/login" onClick={() => setIsMenuOpen(false)}>LOGIN</NavLink>
              <NavLink to="/signup" className="btn-signup" onClick={() => setIsMenuOpen(false)}>SIGN UP</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;
