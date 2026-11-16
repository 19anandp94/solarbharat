import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const benefits = [
  ['01', 'Lower electricity bills', 'Produce your own clean power and reduce your monthly electricity costs.'],
  ['02', 'A home that gives back', 'Solar adds long-term value while making a positive everyday impact.'],
  ['03', 'Clean energy, made simple', 'Our local team manages every detail from design to switch-on.']
]

function LeadForm() {
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault(); setLoading(true); setError('')
    const data = Object.fromEntries(new FormData(e.currentTarget))
    try {
      const r = await fetch('/api/leads', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) })
      if (!r.ok) throw new Error()
      setSent(true)
    } catch { setError('Something went wrong. Please try again.') } finally { setLoading(false) }
  }
  if (sent) return <div className="success"><span>✓</span><h3>We’ve got your enquiry.</h3><p>Our solar advisor will be in touch within one business day.</p></div>
  return <form onSubmit={submit} className="lead-form">
    <label>Your name<input name="name" placeholder="e.g. Ananya Sharma" required /></label>
    <label>Phone number<input name="phone" type="tel" placeholder="10-digit mobile number" required /></label>
    <label>City<input name="city" placeholder="Where is your home?" required /></label>
    <label>Average monthly bill<select name="electricity_bill" defaultValue="" required><option value="" disabled>Select a range</option><option>Under ₹2,000</option><option>₹2,000 – ₹5,000</option><option>₹5,000 – ₹10,000</option><option>Over ₹10,000</option></select></label>
    <label className="wide">Email (optional)<input name="email" type="email" placeholder="you@example.com" /></label>
    {error && <p className="error">{error}</p>}<button disabled={loading}>{loading ? 'Sending...' : 'Get my free solar estimate'} →</button>
  </form>
}

function ProgressPortal() {
  const [open, setOpen] = useState(false), [phone, setPhone] = useState(''), [otp, setOtp] = useState(''), [devOtp, setDevOtp] = useState(''), [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function sendCode(e) { e.preventDefault(); setBusy(true); setError(''); try { const r=await fetch('/api/auth/request-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})}); const j=await r.json(); if(!r.ok) throw Error(); setDevOtp(j.development_otp) } catch {setError('Could not send a code.')} finally {setBusy(false)} }
  async function verify(e) { e.preventDefault(); setBusy(true); setError(''); try { const r=await fetch('/api/auth/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,otp})}); const j=await r.json(); if(!r.ok) throw Error(j.detail); setData(j) } catch(e) {setError(e.message || 'Could not verify code.')} finally {setBusy(false)} }
  return <><button className="portal-trigger" onClick={()=>setOpen(true)}>Track your installation <span>→</span></button>{open && <div className="modal-backdrop" onClick={()=>setOpen(false)}><section className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setOpen(false)}>×</button>{data ? <><p className="eyebrow">INSTALLATION STATUS</p><h2>Hello, {data.customer_name}</h2><p className="muted">{data.capacity} · Last updated today</p><div className="timeline">{data.steps.map((step,i)=><div className={i < data.current_step ? 'done' : ''} key={step}><i>{i < data.current_step ? '✓' : i+1}</i><span>{step}</span></div>)}</div></> : !devOtp ? <form onSubmit={sendCode}><p className="eyebrow">CUSTOMER PORTAL</p><h2>See your solar journey.</h2><p className="muted">Enter the phone number you used for your installation.</p><label>Mobile number<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="10-digit mobile number" required /></label>{error&&<p className="error">{error}</p>}<button disabled={busy}>{busy?'Sending...':'Send verification code'} →</button></form> : <form onSubmit={verify}><p className="eyebrow">VERIFY YOUR NUMBER</p><h2>One last step.</h2><p className="demo-code">Demo code: <b>{devOtp}</b></p><label>Verification code<input value={otp} onChange={e=>setOtp(e.target.value)} placeholder="6-digit code" required /></label>{error&&<p className="error">{error}</p>}<button disabled={busy}>{busy?'Checking...':'View my progress'} →</button></form>}</section>
</div>}</>
}

function AdminPanel() {
  const [token, setToken] = useState(localStorage.getItem('dga_admin_token') || '')
  const [username, setUsername] = useState('admin'), [password, setPassword] = useState(''), [leads, setLeads] = useState([]), [query, setQuery] = useState(''), [error, setError] = useState('')
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  async function loadLeads(search = query) { const r = await fetch(`/api/admin/leads?query=${encodeURIComponent(search)}`, { headers }); if (!r.ok) { setToken(''); localStorage.removeItem('dga_admin_token'); throw new Error('Your session has expired.'); } setLeads(await r.json()) }
  async function login(e) { e.preventDefault(); setError(''); const r = await fetch('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username,password}) }); const data = await r.json(); if (!r.ok) return setError(data.detail || 'Unable to sign in.'); localStorage.setItem('dga_admin_token', data.token); setToken(data.token) }
  async function updateStatus(id, status) { await fetch(`/api/admin/leads/${id}`, { method:'PATCH', headers, body:JSON.stringify({status}) }); loadLeads() }
  useEffect(() => { if (token) loadLeads('').catch(e => setError(e.message)) }, [token])
  if (!token) return <main className="admin-login"><a className="brand" href="/"><span>☀</span> DGA Bharat Solar</a><section><p className="eyebrow">ADMIN PORTAL</p><h1>Welcome back.</h1><p>Sign in to manage customer enquiries.</p><form onSubmit={login}><label>Username<input value={username} onChange={e=>setUsername(e.target.value)} required /></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>{error && <p className="error">{error}</p>}<button>Sign in →</button></form></section>
</main>
  return <main className="admin-shell"><header><a className="brand" href="/"><span>☀</span> DGA Bharat Solar</a><button className="admin-signout" onClick={()=>{localStorage.removeItem('dga_admin_token');setToken('')}}>Sign out</button></header><section className="admin-content"><p className="eyebrow">ADMIN PORTAL</p><h1>Enquiry leads</h1><div className="admin-toolbar"><input placeholder="Search name, phone or city" value={query} onChange={e=>setQuery(e.target.value)} /><button onClick={()=>loadLeads().catch(e=>setError(e.message))}>Search</button></div>{error&&<p className="error">{error}</p>}<div className="lead-table"><div className="lead-row lead-head"><span>Customer</span><span>Location</span><span>Monthly bill</span><span>Enquiry</span><span>Status</span></div>{leads.length ? leads.map(lead=><div className="lead-row" key={lead.id}><span><b>{lead.name}</b><small>{lead.phone}<br/>{lead.email || 'No email'}</small></span><span>{lead.city}</span><span>{lead.electricity_bill}</span><span>{new Date(lead.created_at).toLocaleDateString()}</span><span><select value={lead.status} onChange={e=>updateStatus(lead.id,e.target.value)}>{['New','Contacted','Site visit','Converted','Closed'].map(status=><option key={status}>{status}</option>)}</select></span></div>) : <p className="empty">No leads yet. New enquiries will appear here.</p>}</div></section>
</main>
}

function App() { return <><header><a className="brand" href="#top"><span>☀</span> DGA Bharat Solar</a>
<nav><a href="#benefits">Why solar</a><a href="#subsidy">Subsidy support</a><a href="#founders">Our founders</a><a href="#estimate">Free estimate</a></nav>
<ProgressPortal /></header><main id="top"><section className="hero"><div className="hero-copy"><p className="eyebrow">BRIGHTER HOMES, BETTER TOMORROWS</p><h1>Power your home<br/>with the <em>sun.</em></h1><p className="intro">A simpler way to make clean energy part of everyday life. We’ll design, install, and support your solar system.</p><a className="button-link" href="#estimate">Start with a free estimate <b>→</b></a><div className="rating"><div className="faces">☘ ☺ ☘</div><span><b>4.9 / 5</b><br/>from 500+ homeowners</span></div></div><div className="hero-image"><img src="/images/solar-home-hero-v2.png" alt="Family beside a home with rooftop solar panels"/><div className="image-note"><span>✦</span><div><b>25 years</b><small>panel performance warranty</small></div></div></div></section>

<section id="installation-services" className="installation-services"><p className="eyebrow">END-TO-END SOLAR CARE</p><div className="services-heading"><h2>Installation<br/><em>&amp; services.</em></h2><p>From getting your solar system installed to ongoing care, DGA Bharat Solar supports homeowners across Uttar Pradesh.</p></div><div className="services-list"><article><span>01</span><h3>Solar installation</h3><p>We’ll help you move from a home solar estimate to a professionally installed system.</p></article><article><span>02</span><h3>Ongoing support</h3><p>Get guidance and support throughout your solar journey, from planning through switch-on.</p></article><article><span>03</span><h3>Servicing &amp; maintenance</h3><p>Access solar servicing and maintenance support across Uttar Pradesh.</p></article></div></section>

<section id="benefits" className="benefits"><p className="eyebrow">WHY HOMES CHOOSE DGA BHARAT SOLAR</p><h2>Good for your pocket.<br/><em>Great for the planet.</em></h2><div className="benefit-grid">{benefits.map(([n,t,d])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}</div></section>

<section id="subsidy" className="subsidy"><div className="subsidy-mark">₹<small>+</small></div><div><p className="eyebrow">MAKE SOLAR MORE AFFORDABLE</p><h2>We help you understand<br/><em>subsidy support.</em></h2></div><div className="subsidy-copy"><p>DGA Bharat Solar helps homeowners understand the government-subsidy process for eligible rooftop solar installations.</p><p>Our team can guide you through the documentation and application steps, so you know what to expect before you begin.</p><a href="#estimate">Check your eligibility <b>→</b></a><small>Subsidy availability, eligibility and final approval are determined by the relevant government authorities.</small></div></section>

<section id="founders" className="founders"><div className="founders-heading"><p className="eyebrow">THE PEOPLE BEHIND DGA BHARAT SOLAR</p><h2>Meet our <em>founders.</em></h2><p>We bring operational expertise and practical technology together to make solar simpler for every home.</p></div><div className="founder-grid"><article className="founder-card"><img src="/images/founders/divyansh-rao.jpg" alt="Divyansh Rao"/><div><h3>Divyansh Rao <span>(IIIT Prayagraj – B.Tech)</span></h3><p className="founder-role">Executive &amp; Director</p><p className="founder-detail">8 years of industry experience</p></div></article><article className="founder-card"><img src="/images/founders/gyan-prakash.jpg" alt="Gyan Prakash"/><div><h3>Gyan Prakash <span>(District Head of Solar Installations)</span></h3><p className="founder-role">Chief of Operations &amp; Director</p><p className="founder-detail">4 years of experience</p></div></article><article className="founder-card"><img src="/images/founders/anand-prakash.jpg" alt="Anand Prakash"/><div><h3>Anand Prakash <span>(IIIT Prayagraj – B.Tech)</span></h3><p className="founder-role">Technology Lead &amp; Director</p><p className="founder-detail">10 years of industry experience</p></div></article></div></section>
<section id="estimate" className="estimate"><div><p className="eyebrow">YOUR SOLAR JOURNEY STARTS HERE</p><h2>Let’s find the right<br/><em>fit for your home.</em></h2><p>Tell us a little about your home. There’s no pressure—just helpful advice and a clear estimate.</p><div className="callout">☀ <span><b>Free, no-obligation consultation</b><br/>Usually takes less than 15 minutes.</span></div></div><div className="form-card"><h3>Get your free estimate</h3><p>We’ll call at a time that works for you.</p><LeadForm /></div></section>
</main><footer><div className="footer-brand-group"><a className="brand" href="#top"><span>☀</span> DGA Bharat Solar</a><p className="footer-service">Solar servicing and maintenance across Uttar Pradesh.</p></div><p>Clean energy for everyday homes.</p><p>© 2026 DGA Bharat Solar</p></footer></> }
createRoot(document.getElementById('root')).render(window.location.pathname === '/admin' ? <AdminPanel /> : <App />)
