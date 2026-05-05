import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../lib/api';
import './Agent.css';

const fallbackAgents = [
  {
    id: 1,
    agent: 'John Smith',
    code: 'AGT-1001',
    email: 'john@autoauction.com',
    description: 'Senior sales consultant for premium and imported vehicles.',
    icon: 'https://i.pravatar.cc/500?img=12',
  },
  {
    id: 2,
    agent: 'Sarah Lee',
    code: 'AGT-1002',
    email: 'sarah@autoauction.com',
    description: 'Auction specialist handling live bidding and buyer support.',
    icon: 'https://i.pravatar.cc/500?img=32',
  },
  {
    id: 3,
    agent: 'Michael Tan',
    code: 'AGT-1003',
    email: 'michael@autoauction.com',
    description: 'Customer relations expert focused on delivery and documentation.',
    icon: 'https://i.pravatar.cc/500?img=52',
  },
];

function Agent() {
  const [agents, setAgents] = useState(fallbackAgents);
  const [searchType, setSearchType] = useState('code');
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const resultRef = useRef(null);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await api.get('/agent');
        const list = Array.isArray(response.data?.agents) ? response.data.agents : [];
        if (list.length > 0) {
          const normalized = list.map((item, index) => ({
            id: item.id ?? index + 1,
            agent: item.agent || item.name || '-',
            code: item.code || `AGT-${String(item.id ?? index + 1).padStart(4, '0')}`,
            email: item.email || '-',
            description: item.description || item.role || '-',
            icon: item.icon || item.photo || 'https://via.placeholder.com/500x500?text=Agent',
          }));
          setAgents(normalized);
        }
      } catch {
        setAgents(fallbackAgents);
      }
    };
    fetchAgents();
  }, []);

  const results = useMemo(() => {
    if (submitted === null) return [];
    if (submitted === '__all__') return agents;
    const q = submitted.trim().toLowerCase();
    return agents.filter((item) => {
      if (searchType === 'code') return String(item.code).toLowerCase().includes(q);
      if (searchType === 'email') return String(item.email).toLowerCase().includes(q);
      return String(item.agent).toLowerCase().includes(q);
    });
  }, [agents, searchType, submitted]);

  const handleSearch = (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    setSubmitted(trimmed ? trimmed : '__all__');
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };

  const labelMap = {
    code: 'Agent Code',
    email: 'Agent Email',
    name: 'Agent Name',
  };

  return (
    <div className="agent-page-ref">
      <section className="agent-banner">
        <img
          src="https://jojieautogarage.com/images/background/main-banner.png"
          alt="Agent banner"
        />
      </section>

      <section className="agent-search-section">
        <div className="container">
          <div className="agent-search-card">
            <h1>FIND AGENT</h1>
            <form onSubmit={handleSearch}>
              <label>{labelMap[searchType]}</label>
              <select value={searchType} onChange={(event) => setSearchType(event.target.value)}>
                <option value="code">Agent Code</option>
                <option value="email">Agent Email</option>
                <option value="name">Agent Name</option>
              </select>

              <label>{labelMap[searchType]}</label>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Enter Agent name, Agent Code or Agent Email"
              />

              <button type="submit">Search</button>
            </form>
          </div>
        </div>
      </section>

      <section className="agent-result-section">
        <div className="container" ref={resultRef}>
          {submitted === null && <p className="result-tip">Search by code, email or name.</p>}
          {submitted !== null && results.length === 0 && (
            <p className="no-result">No Agent Found</p>
          )}
          {submitted === '__all__' && results.length > 0 && (
            <p className="result-tip">Showing all available agents.</p>
          )}

          {results.map((item) => (
            <div className="agent-result-card" key={item.id}>
              <h2>SEARCH RESULTS</h2>
              <div className="agent-result-grid">
                <div className="agent-result-image">
                  <img src={item.icon} alt={item.agent} />
                </div>
                <div className="agent-info-box">
                  <h3>Agent Information</h3>
                  <div className="info-row">
                    <span>Agent Name</span>
                    <strong>{item.agent}</strong>
                  </div>
                  <div className="info-row">
                    <span>Agent ID</span>
                    <strong>{item.code}</strong>
                  </div>
                  <div className="info-row">
                    <span>Agent Email</span>
                    <strong>{item.email}</strong>
                  </div>
                  <div className="info-row">
                    <span>Agent Description</span>
                    <strong>{item.description}</strong>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Agent;
