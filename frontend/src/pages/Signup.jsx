import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getApiErrorMessage } from '../lib/api';
import './Signup.css';

function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    icPassport: '',
    gender: '',
    companyName: '',
    companyPhone: '',
    tinNumber: '',
    street: '',
    zipCode: '',
    city: '',
    state: '',
    country: '',
    callingCode: '+60',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const callingCodes = ['+60', '+65', '+86', '+62', '+66', '+84', '+1', '+44'];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (!formData.phoneNumber.trim()) {
      setError('Phone number is required.');
      return;
    }

    setLoading(true);

    try {
      const submitData = {
        // Core auth fields
        name: formData.fullName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: `${formData.callingCode} ${formData.phoneNumber.trim()}`,
        // Profile fields
        ic_passport: formData.icPassport.trim() || null,
        gender: formData.gender || null,
        company_name: formData.companyName.trim() || null,
        company_phone: formData.companyPhone.trim() || null,
        tin_number: formData.tinNumber.trim() || null,
        address_street: formData.street.trim() || null,
        address_zip: formData.zipCode.trim() || null,
        address_city: formData.city.trim() || null,
        address_state: formData.state.trim() || null,
        address_country: formData.country.trim() || null,
      };

      await api.post('/auth/register', submitData);
      setSuccess('Registration successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-layout">
        <aside className="signup-image-panel">
          <img
            src="https://jojieautogarage.com/images/background/signup-image.png"
            alt="Signup"
          />
        </aside>
        <section className="signup-form-panel">
          <div className="signup-form-wrap">
            <h1>SIGN UP</h1>
            <p className="signup-subtitle">Create your SG AUTO TRADING bidding account.</p>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <form onSubmit={handleSubmit} className="signup-form">
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="username@address.com"
                />
              </div>

              <div className="signup-grid two-col">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    placeholder="Full Name"
                  />
                </div>
                <div className="form-group">
                  <label>IC / Passport</label>
                  <input
                    type="text"
                    name="icPassport"
                    value={formData.icPassport}
                    onChange={handleChange}
                    placeholder="IC / Passport"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Gender *</label>
                <div className="gender-row">
                  <label>
                    <input
                      type="radio"
                      name="gender"
                      value="Male"
                      checked={formData.gender === 'Male'}
                      onChange={handleChange}
                      required
                    />
                    <span>Male</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="gender"
                      value="Female"
                      checked={formData.gender === 'Female'}
                      onChange={handleChange}
                      required
                    />
                    <span>Female</span>
                  </label>
                </div>
              </div>

              <div className="signup-grid two-col">
                <div className="form-group">
                  <label>Company Name</label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    placeholder="Company Name"
                  />
                </div>
                <div className="form-group">
                  <label>Company Phone / Fax</label>
                  <input
                    type="text"
                    name="companyPhone"
                    value={formData.companyPhone}
                    onChange={handleChange}
                    placeholder="Company Phone"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>TIN Number</label>
                <input
                  type="text"
                  name="tinNumber"
                  value={formData.tinNumber}
                  onChange={handleChange}
                  placeholder="TIN Number ( TAX IDENTIFICATION NUMBER) if available"
                />
              </div>

              <div className="signup-grid two-col">
                <div className="form-group">
                  <label>Street *</label>
                  <input
                    type="text"
                    name="street"
                    value={formData.street}
                    onChange={handleChange}
                    required
                    placeholder="Street 1"
                  />
                </div>
                <div className="form-group">
                  <label>Zip / Postal Code *</label>
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleChange}
                    required
                    placeholder="Zip / Postal Code"
                  />
                </div>
              </div>

              <div className="signup-grid two-col">
                <div className="form-group">
                  <label>City *</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    required
                    placeholder="City"
                  />
                </div>
                <div className="form-group">
                  <label>State *</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    required
                    placeholder="State"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Country *</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  required
                  placeholder="Country"
                />
              </div>

              <div className="form-group">
                <label>Phone Number *</label>
                <div className="phone-row">
                  <select name="callingCode" value={formData.callingCode} onChange={handleChange}>
                    {callingCodes.map((code) => (
                      <option value={code} key={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    required
                    placeholder="XXXXXXXX"
                  />
                </div>
              </div>

              <div className="signup-grid two-col">
                <div className="form-group">
                  <label>Enter Password *</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="********"
                  />
                </div>
                <div className="form-group">
                  <label>Confirm Password *</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    placeholder="********"
                  />
                </div>
              </div>

              <button type="submit" className="signup-btn" disabled={loading}>
                {loading ? 'Creating Account...' : 'Sign Up'}
              </button>
            </form>

            <p className="signup-footer">
              Already have account ? <Link to="/login">Login</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Signup;