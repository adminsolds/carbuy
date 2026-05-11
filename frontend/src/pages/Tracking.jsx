import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getApiErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import './Tracking.css';

function Tracking() {
  const { isAuthenticated } = useAuth();
  const [bids, setBids] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('orders');
  const [lookupAccount, setLookupAccount] = useState('');
  const [hasLookedUp, setHasLookedUp] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      setBids([]);
      setOrders([]);
      setActiveTab('orders');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const [bidsRes, ordersRes] = await Promise.all([
          api.get('/bids/me').catch(() => ({ data: { bids: [] } })),
          api.get('/orders/me').catch(() => ({ data: { orders: [] } })),
        ]);
        setBids(bidsRes.data.bids || []);
        setOrders(ordersRes.data.orders || []);
      } catch (requestError) {
        setError(getApiErrorMessage(requestError, 'Failed to load your records.'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated]);

  const lookupOrdersByAccount = async () => {
    const account = lookupAccount.trim();
    if (!account) {
      setError('Please enter your account (email / phone / name).');
      return;
    }

    try {
      setError('');
      setLookupLoading(true);
      setHasLookedUp(true);
      const response = await api.get('/orders/lookup', { params: { account } });
      setOrders(response.data.orders || []);
      setActiveTab('orders');
    } catch (requestError) {
      setOrders([]);
      setError(getApiErrorMessage(requestError, 'Failed to lookup orders.'));
    } finally {
      setLookupLoading(false);
    }
  };

  const getBidBadge = (status) => {
    const badges = {
      winning: { class: 'winning', label: 'Winning' },
      outbid: { class: 'outbid', label: 'Outbid' },
      won: { class: 'won', label: 'Won' },
      lost: { class: 'lost', label: 'Lost' },
    };
    return badges[status] || badges.lost;
  };

  const getOrderBadge = (status) => {
    const map = {
      pending: { class: 'outbid', label: 'Pending' },
      deposit_paid: { class: 'winning', label: 'Deposit Paid' },
      paid: { class: 'winning', label: 'Paid' },
      processing: { class: 'winning', label: 'Processing' },
      shipped: { class: 'winning', label: 'Shipped' },
      delivered: { class: 'won', label: 'Delivered' },
      completed: { class: 'won', label: 'Completed' },
      cancelled: { class: 'lost', label: 'Cancelled' },
      refunded: { class: 'lost', label: 'Refunded' },
    };
    return map[status] || { class: 'outbid', label: status };
  };

  const formatStatusFlow = (status) => {
    const steps = ['pending', 'deposit_paid', 'paid', 'processing', 'shipped', 'delivered', 'completed'];
    const currentIndex = steps.indexOf(status);
    if (currentIndex === -1) return null;
    return steps.slice(0, currentIndex + 1);
  };

  const filteredOrders = orders.filter((order) => {
    if (orderStatus !== 'all' && order.status !== orderStatus) return false;
    if (!orderSearch.trim()) return true;
    const keyword = orderSearch.trim().toLowerCase();
    const text = [
      order.order_no,
      order.car ? `${order.car.brand} ${order.car.model}` : '',
      order.status,
    ].join(' ').toLowerCase();
    return text.includes(keyword);
  });

  return (
    <div className="tracking">
      <div className="container">
        <h1>MY DASHBOARD</h1>
        <p className="subtitle">{isAuthenticated ? 'Track your orders and auction bids' : 'Track your order status by account'}</p>

        {!isAuthenticated && (
          <div className="order-lookup-box">
            <input
              type="text"
              value={lookupAccount}
              onChange={(e) => setLookupAccount(e.target.value)}
              placeholder="Enter account (email / phone / name)"
              onKeyDown={(e) => { if (e.key === 'Enter') lookupOrdersByAccount(); }}
            />
            <button type="button" onClick={lookupOrdersByAccount} disabled={lookupLoading}>
              {lookupLoading ? 'Searching...' : 'Search Orders'}
            </button>
          </div>
        )}

        <div className="tracking-tabs">
          <button
            className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            My Orders {orders.length > 0 && <span className="tab-count">{orders.length}</span>}
          </button>
          {isAuthenticated && (
            <button
              className={`tab-btn ${activeTab === 'bids' ? 'active' : ''}`}
              onClick={() => setActiveTab('bids')}
            >
              My Bids {bids.length > 0 && <span className="tab-count">{bids.length}</span>}
            </button>
          )}
        </div>

        <div className="tracking-content">
          {loading ? (
            <div className="empty-state">
              <p>Loading...</p>
            </div>
          ) : activeTab === 'orders' ? (
            <>
              <div className="order-filters">
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search by order number or car model"
                />
                <select value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)}>
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="deposit_paid">Deposit Paid</option>
                  <option value="paid">Paid</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="empty-state">
                  <p>
                    {orders.length === 0
                      ? (isAuthenticated ? "You haven't placed any orders yet." : (hasLookedUp ? 'No orders found for this account.' : 'Enter your account above to search orders.'))
                      : 'No matching orders found.'}
                  </p>
                  <Link to="/cars" className="browse-btn">Browse Cars</Link>
                </div>
              ) : (
                <div className="orders-list">
                  {filteredOrders.map((order) => {
                    const badge = getOrderBadge(order.status);
                    const completedSteps = formatStatusFlow(order.status);
                    return (
                      <div key={order.id} className="order-card">
                        <div className="order-header">
                          <div>
                            <span className="order-no">{order.order_no}</span>
                            <span className={`status-badge ${badge.class}`}>{badge.label}</span>
                            <span className={`order-type-badge ${order.order_type === 'auction_win' ? 'auction' : 'purchase'}`}>
                              {order.order_type === 'auction_win' ? 'Auction Win' : 'Purchase'}
                            </span>
                          </div>
                          <span className="order-date">
                            {new Date(order.createdAt).toLocaleDateString('en-MY', { dateStyle: 'medium' })}
                          </span>
                        </div>

                        {order.car && (
                          <div className="order-car-info">
                            <h3>{order.car.brand} {order.car.model} ({order.car.year})</h3>
                            <span className="order-amount">RM {Number(order.amount || 0).toLocaleString()}</span>
                          </div>
                        )}

                        {completedSteps && (
                          <div className="order-progress">
                            {['pending', 'deposit_paid', 'paid', 'processing', 'shipped', 'delivered'].map((step) => {
                              const isDone = completedSteps.includes(step);
                              const isCurrent = order.status === step;
                              return (
                                <div key={step} className={`progress-step ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
                                  <div className="step-dot"></div>
                                  <span className="step-label">{step.replace('_', ' ')}</span>
                                </div>
                              );
                            })}
                            {order.status === 'completed' && (
                              <div className={`progress-step done`}>
                                <div className="step-dot"></div>
                                <span className="step-label">completed</span>
                              </div>
                            )}
                          </div>
                        )}

                        {(order.status === 'cancelled' || order.status === 'refunded') && (
                          <div className="order-cancelled-note">
                            This order has been {order.status}.
                          </div>
                        )}

                        <div className="order-details">
                          {order.user && (
                            <div className="detail-item">
                              <span className="detail-label">Account</span>
                              <span className="detail-value">{order.user.name} ({order.user.email})</span>
                            </div>
                          )}
                          {order.agent && (
                            <div className="detail-item">
                              <span className="detail-label">Agent</span>
                              <span className="detail-value">{order.agent.code} — {order.agent.name}</span>
                            </div>
                          )}
                          {order.delivery_address && (
                            <div className="detail-item">
                              <span className="detail-label">Delivery Address</span>
                              <span className="detail-value">{order.delivery_address}</span>
                            </div>
                          )}
                          {order.notes && (
                            <div className="detail-item">
                              <span className="detail-label">Notes</span>
                              <span className="detail-value">{order.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              {bids.length === 0 ? (
                <div className="empty-state">
                  <p>You haven't placed any bids yet.</p>
                  <Link to="/cars" className="browse-btn">Browse Cars</Link>
                </div>
              ) : (
                <div className="bids-list">
                  {bids.map((bid) => {
                    const badge = getBidBadge(bid.status);
                    return (
                      <div key={bid.id} className="bid-card">
                        <div className="bid-info">
                          <h3>{bid.carName}</h3>
                          <p className="bid-date">
                            Bid placed on {new Date(bid.createdAt).toLocaleDateString('en-MY', { dateStyle: 'medium' })}
                          </p>
                        </div>
                        <div className="bid-amount">
                          <span className="label">Your Bid</span>
                          <span className="amount">RM {Number(bid.bidAmount).toLocaleString()}</span>
                        </div>
                        <div className="bid-status">
                          <span className={`status-badge ${badge.class}`}>{badge.label}</span>
                        </div>
                        <Link to={`/cars/${bid.carId}`} className="view-btn">View Car</Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {error && <p className="subtitle" style={{ color: '#dc2626' }}>{error}</p>}

        <div className="tips-section">
          <h3>Order & Bidding Tips</h3>
          <ul>
            <li>Keep track of your order status — deposit payment moves your order forward</li>
            <li>Monitor your bids regularly to stay informed about competing offers</li>
            <li>Set a maximum budget and stick to it to avoid overbidding</li>
            <li>Contact your agent for delivery updates once your order is shipped</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Tracking;
