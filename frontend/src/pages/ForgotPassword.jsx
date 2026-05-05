import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { getApiErrorMessage } from '../lib/api';
import './Auth.css';

function ForgotPassword() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: formData.email.trim() });
      setSuccess('Password reset link sent! Check your email.');
      setFormData({ email: '' });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to send reset email. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1>FORGOT PASSWORD</h1>
        <p className="auth-subtitle">Enter your email to receive a password reset link.</p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="your@email.com"
            />
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Sending...' : 'SEND RESET LINK'}
          </button>
        </form>

        <p className="auth-footer">
          Remember your password? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;
