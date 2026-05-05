const express = require('express');
const router = express.Router();

// Calculate monthly payment
router.post('/calculate', (req, res) => {
  try {
    const { loanAmount, annualRate, tenureMonths } = req.body;

    if (loanAmount === undefined || annualRate === undefined || tenureMonths === undefined) {
      return res.status(400).json({
        error: 'Loan amount, annual rate, and tenure are required.'
      });
    }

    const P = parseFloat(loanAmount);
    const r = parseFloat(annualRate) / 100 / 12; // Monthly interest rate
    const n = parseInt(tenureMonths);

    // M = P * [r(1+r)^n] / [(1+r)^n - 1]
    let monthlyPayment;
    if (r === 0) {
      monthlyPayment = P / n;
    } else {
      monthlyPayment = P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    }

    const totalPayment = monthlyPayment * n;
    const totalInterest = totalPayment - P;

    res.json({
      loanAmount: P,
      annualRate: parseFloat(annualRate),
      tenureMonths: n,
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      totalPayment: Math.round(totalPayment * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100
    });
  } catch (error) {
    console.error('Loan calculation error:', error);
    res.status(500).json({ error: 'Calculation failed.' });
  }
});

module.exports = router;
