import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api, { getApiErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const initialEmail = useMemo(() => {
    const fromState = location.state?.email;
    const fromQuery = searchParams.get('email');
    return String(fromState || fromQuery || '').trim();
  }, [location.state, searchParams]);

  const [formData, setFormData] = useState({
    email: initialEmail,
    code: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.email.trim() || !formData.code.trim()) {
      setError('Please enter your email and verification code.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/verify-email-code', {
        email: formData.email.trim(),
        code: formData.code.trim()
      });

      if (response.data?.token && response.data?.user) {
        login({ token: response.data.token, user: response.data.user });
      }
      setSuccess('Email verified successfully! Redirecting...');
      setTimeout(() => navigate('/tracking'), 1200);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to verify code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setSuccess('');

    if (!formData.email.trim()) {
      setError('Please enter your email first.');
      return;
    }

    setResending(true);
    try {
      const response = await api.post('/auth/resend-verification-code', {
        email: formData.email.trim()
      });
      setSuccess(response.data?.message || 'Verification code sent. Please check your email.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to resend verification code.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1>EMAIL VERIFICATION</h1>
        <p className="auth-subtitle">Enter the 6-digit code sent to your email.</p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleVerify} className="auth-form">
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="your@email.com"
            />
          </div>

          <div className="form-group">
            <label>Verification Code</label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleChange}
              required
              maxLength={6}
              placeholder="Enter 6-digit code"
            />
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Verifying...' : 'VERIFY EMAIL'}
          </button>

          <button type="button" className="auth-btn" disabled={resending} onClick={handleResend}>
            {resending ? 'Sending...' : 'RESEND CODE'}
          </button>
        </form>

        <p className="auth-footer">
          Back to <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default VerifyEmail;
