import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getApiErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import './Tracking.css';

const ORDER_STEP_LABELS = [
  { key: 'step1', label: 'Step1' },
  { key: 'step2', label: 'Step2' },
  { key: 'step3', label: 'Step3' },
  { key: 'step4', label: 'Step4' },
  { key: 'step5', label: 'Step5' },
  { key: 'step6', label: 'Step6' },
];

const STEP_BADGE_CLASS = {
  step1: 'outbid',
  step2: 'winning',
  step3: 'winning',
  step4: 'winning',
  step5: 'winning',
  step6: 'won',
};

function Tracking() {
  const { isAuthenticated } = useAuth();
  const [bids, setBids] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('orders');
  const [lookupAccount, setLookupAccount] = useState('');
  const [lookupOrderNo, setLookupOrderNo] = useState('');
  const [hasLookedUp, setHasLookedUp] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
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

  const lookupOrders = async () => {
    const account = lookupAccount.trim();
    const order_no = lookupOrderNo.trim();
    if (!account && !order_no) {
      setError('Please enter account or order number.');
      return;
    }

    try {
      setError('');
      setLookupLoading(true);
      setHasLookedUp(true);
      const response = await api.get('/orders/lookup', {
        params: {
          account: account || undefined,
          order_no: order_no || undefined
        }
      });
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

  const getOrderStepKey = (order) => {
    const statusSteps = order?.status_steps;
    if (!statusSteps || typeof statusSteps !== 'object') return '';
    const activeStep = typeof statusSteps.active_step === 'string' ? statusSteps.active_step.trim().toLowerCase() : '';
    if (ORDER_STEP_LABELS.some((item) => item.key === activeStep)) return activeStep;
    for (let i = ORDER_STEP_LABELS.length - 1; i >= 0; i -= 1) {
      const stepKey = ORDER_STEP_LABELS[i].key;
      const text = typeof statusSteps[stepKey] === 'string' ? statusSteps[stepKey].trim() : '';
      if (text) return stepKey;
    }
    return '';
  };

  const getOrderBadge = (order) => {
    if (order?.payment_confirmed === false) {
      return { class: 'processing', label: order?.status_label || 'Order Processing' };
    }
    const stepKey = getOrderStepKey(order);
    if (stepKey) {
      const label = ORDER_STEP_LABELS.find((item) => item.key === stepKey)?.label || stepKey;
      return { class: STEP_BADGE_CLASS[stepKey] || 'winning', label };
    }
    const status = String(order?.status || 'unknown').toLowerCase();
    if (status === 'cancelled' || status === 'refunded') {
      return { class: 'lost', label: status.replace(/_/g, ' ') };
    }
    return { class: 'outbid', label: status.replace(/_/g, ' ') };
  };

  const getManualStatusSteps = (statusSteps) => {
    return ORDER_STEP_LABELS
      .map(({ key, label }) => ({
        label,
        text: statusSteps && typeof statusSteps === 'object' && typeof statusSteps[key] === 'string'
          ? statusSteps[key].trim()
          : ''
      }))
      .filter((item) => item.text);
  };

  const getOrderPrimaryImage = (order) => {
    if (Array.isArray(order?.images) && order.images.length > 0) return order.images[0];
    if (Array.isArray(order?.car?.images) && order.car.images.length > 0) return order.car.images[0];
    return '';
  };

  const getVehicleLabel = (order) => {
    const customVehicleName = typeof order?.custom_vehicle_details?.vehicle_name === 'string'
      ? order.custom_vehicle_details.vehicle_name.trim()
      : '';
    if (customVehicleName) return customVehicleName;

    const inventoryVehicleName = typeof order?.car?.vehicle_name === 'string'
      ? order.car.vehicle_name.trim()
      : '';
    if (inventoryVehicleName) return inventoryVehicleName;

    if (order?.custom_vehicle) return order.custom_vehicle;
    if (order?.vehicle_label) return order.vehicle_label;
    if (order?.car) return `${order.car.brand} ${order.car.model}${order.car.year ? ` (${order.car.year})` : ''}`;
    return 'Vehicle Information Pending';
  };

  return (
    <div className="tracking">
      <div className="container">
        <h1>MY DASHBOARD</h1>
        <p className="subtitle">{isAuthenticated ? 'Track your orders and auction bids' : 'Track your order status by account or order number'}</p>

        <div className="order-lookup-box">
          <input
            type="text"
            value={lookupAccount}
            onChange={(e) => setLookupAccount(e.target.value)}
            placeholder="Enter account (email / phone / name)"
            onKeyDown={(e) => { if (e.key === 'Enter') lookupOrders(); }}
          />
          <input
            type="text"
            value={lookupOrderNo}
            onChange={(e) => setLookupOrderNo(e.target.value)}
            placeholder="Enter order number (e.g. ORD-20260521-ABC123)"
            onKeyDown={(e) => { if (e.key === 'Enter') lookupOrders(); }}
          />
          <button type="button" onClick={lookupOrders} disabled={lookupLoading}>
            {lookupLoading ? 'Searching...' : 'Search Orders'}
          </button>
        </div>

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
              {orders.length === 0 ? (
                <div className="empty-state">
                  <p>
                    {orders.length === 0
                      ? (isAuthenticated ? "You haven't placed any orders yet." : (hasLookedUp ? 'No orders found for this account / order number.' : 'Enter account or order number above to search orders.'))
                      : 'No matching orders found.'}
                  </p>
                  <Link to="/cars" className="browse-btn">Browse Cars</Link>
                </div>
              ) : (
                <div className="orders-list">
                  {orders.map((order) => {
                    const badge = getOrderBadge(order);
                    const manualSteps = getManualStatusSteps(order.status_steps);
                    const showManualSteps = order?.payment_confirmed !== false;
                    const primaryImage = getOrderPrimaryImage(order);
                    const infoItems = [
                      { label: 'Vehicle Name', value: getVehicleLabel(order) },
                      { label: 'Email', value: order.buyer_email || order.user?.email || '-' },
                      { label: 'Name', value: order.buyer_name || order.user?.name || '-' },
                      { label: 'IC / Passport', value: order.user?.ic_passport || '-' },
                      { label: 'Contact', value: order.buyer_phone || '-' },
                      { label: 'Agent Name', value: order.agent?.name || '-' },
                      { label: 'Tracking ID', value: order.order_no || '-' },
                    ];

                    return (
                      <div key={order.id} className="order-card">
                        <div className="tracking-card-media">
                          {primaryImage ? (
                            <img src={primaryImage} alt={getVehicleLabel(order)} className="tracking-card-image" />
                          ) : (
                            <div className="tracking-card-image tracking-card-placeholder">No Image</div>
                          )}
                        </div>

                        <div className="tracking-info-panel">
                          <div className="tracking-info-head">
                            <h3>{getVehicleLabel(order)}</h3>
                          </div>

                          <div className="tracking-info-grid">
                            {infoItems.map((item) => (
                              <div key={`${order.id}-${item.label}`} className="tracking-info-row">
                                <span className="tracking-info-label">{item.label}</span>
                                <span className="tracking-info-value">{item.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="tracking-status-panel">
                          <div className="tracking-status-head">
                            <h4>Order Status</h4>
                          </div>

                          {!showManualSteps && (
                            <div className="tracking-status-note">Order Processing</div>
                          )}

                          {showManualSteps && manualSteps.length > 0 && (
                            <div className="order-manual-steps">
                              {manualSteps.map((item) => (
                                <div key={`${order.id}-${item.label}`} className="manual-step-item">
                                  <span className="manual-step-text">{item.text}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {showManualSteps && manualSteps.length === 0 && (
                            <div className="tracking-status-note">No step updates yet.</div>
                          )}

                          {(order.status === 'cancelled' || order.status === 'refunded') && (
                            <div className="order-cancelled-note">
                              This order has been {order.status}.
                            </div>
                          )}
                        </div>

                        {Array.isArray(order.images) && order.images.length > 1 && (
                          <div className="order-images order-images-secondary">
                            {order.images.slice(1, 5).map((imageUrl, index) => (
                              <a
                                key={`${order.id}-img-${index + 1}`}
                                href={imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="order-image-thumb"
                                title={`Order Image ${index + 2}`}
                              >
                                <img src={imageUrl} alt={`Order ${order.order_no} image ${index + 2}`} />
                              </a>
                            ))}
                          </div>
                        )}
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
            <li>Keep track of your order status - deposit payment moves your order forward</li>
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
