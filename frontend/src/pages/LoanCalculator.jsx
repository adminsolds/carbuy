import { useState } from 'react';
import api, { getApiErrorMessage } from '../lib/api';
import './LoanCalculator.css';

function LoanCalculator() {
  const [formData, setFormData] = useState({
    loanAmount: '',
    annualRate: '',
    tenureMonths: ''
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const response = await api.post('/loan/calculate', formData);
      setResult(response.data);
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'Unable to reach backend, switched to local calculation.'));
      // Fallback to client-side calculation if backend unavailable
      const P = parseFloat(formData.loanAmount);
      const r = parseFloat(formData.annualRate) / 100 / 12;
      const n = parseInt(formData.tenureMonths);

      let monthlyPayment;
      if (r === 0) {
        monthlyPayment = P / n;
      } else {
        monthlyPayment = P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      }

      const totalPayment = monthlyPayment * n;
      const totalInterest = totalPayment - P;

      setResult({
        loanAmount: P,
        annualRate: parseFloat(formData.annualRate),
        tenureMonths: n,
        monthlyPayment: Math.round(monthlyPayment * 100) / 100,
        totalPayment: Math.round(totalPayment * 100) / 100,
        totalInterest: Math.round(totalInterest * 100) / 100
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({ loanAmount: '', annualRate: '', tenureMonths: '' });
    setResult(null);
    setMessage('');
  };

  return (
    <div className="loan-calculator">
      <div className="container">
        <h1>LOAN CALCULATOR</h1>
        <p className="subtitle">Estimate your monthly car loan payment</p>
        {message && <p className="subtitle">{message}</p>}

        <div className="calculator-content">
          <form onSubmit={handleSubmit} className="calculator-form">
            <div className="form-group">
              <label>Loan Amount (RM)</label>
              <input
                type="number"
                name="loanAmount"
                value={formData.loanAmount}
                onChange={handleChange}
                required
                min="1000"
                placeholder="e.g., 150000"
              />
            </div>

            <div className="form-group">
              <label>Annual Interest Rate (%)</label>
              <input
                type="number"
                name="annualRate"
                value={formData.annualRate}
                onChange={handleChange}
                required
                min="0.1"
                step="0.1"
                placeholder="e.g., 3.5"
              />
            </div>

            <div className="form-group">
              <label>Loan Tenure (Months)</label>
              <select
                name="tenureMonths"
                value={formData.tenureMonths}
                onChange={handleChange}
                required
              >
                <option value="">Select tenure</option>
                <option value="12">12 months (1 year)</option>
                <option value="24">24 months (2 years)</option>
                <option value="36">36 months (3 years)</option>
                <option value="48">48 months (4 years)</option>
                <option value="60">60 months (5 years)</option>
                <option value="72">72 months (6 years)</option>
                <option value="84">84 months (7 years)</option>
              </select>
            </div>

            <div className="form-buttons">
              <button type="submit" className="calc-btn" disabled={loading}>
                {loading ? 'Calculating...' : 'Calculate'}
              </button>
              <button type="button" onClick={handleReset} className="reset-btn">
                Reset
              </button>
            </div>
          </form>

          {result && (
            <div className="result-section">
              <h2>Calculation Results</h2>
              
              <div className="result-item highlight">
                <span className="result-label">Monthly Payment</span>
                <span className="result-value">RM {result.monthlyPayment.toLocaleString()}</span>
              </div>

              <div className="result-item">
                <span className="result-label">Loan Amount</span>
                <span className="result-value">RM {result.loanAmount.toLocaleString()}</span>
              </div>

              <div className="result-item">
                <span className="result-label">Total Interest</span>
                <span className="result-value">RM {result.totalInterest.toLocaleString()}</span>
              </div>

              <div className="result-item">
                <span className="result-label">Total Payment</span>
                <span className="result-value">RM {result.totalPayment.toLocaleString()}</span>
              </div>

              <div className="result-item">
                <span className="result-label">Interest Rate</span>
                <span className="result-value">{result.annualRate}% p.a.</span>
              </div>

              <div className="result-item">
                <span className="result-label">Tenure</span>
                <span className="result-value">{result.tenureMonths} months</span>
              </div>
            </div>
          )}
        </div>

        <div className="info-section">
          <h3>How to use this calculator?</h3>
          <ul>
            <li>Enter the total loan amount you need</li>
            <li>Enter the annual interest rate offered by your bank</li>
            <li>Select your preferred loan tenure</li>
            <li>Click "Calculate" to see your monthly payment</li>
          </ul>
          <p className="disclaimer">
            *This calculator provides estimates only. Actual loan terms may vary.
            Please consult with your bank for accurate quotes.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoanCalculator;
