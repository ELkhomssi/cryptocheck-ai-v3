"use client";

import { useEffect } from "react";

export default function HomePage() {
  useEffect(() => {
    // Smooth active nav highlight
    const sections = document.querySelectorAll("section[id]");
    const navLinks = document.querySelectorAll(".nav-links a");
    const onScroll = () => {
      let cur = "";
      sections.forEach((s) => {
        if (window.scrollY >= (s as HTMLElement).offsetTop - 80) cur = s.id;
      });
      navLinks.forEach((a) => {
        (a as HTMLElement).style.color =
          a.getAttribute("href") === "#" + cur ? "#a78bfa" : "";
      });
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleFaq = (btn: HTMLButtonElement) => {
    const item = btn.closest(".faq-item") as HTMLElement;
    const isOpen = item.classList.contains("open");
    document.querySelectorAll(".faq-item.open").forEach((i) => i.classList.remove("open"));
    if (!isOpen) item.classList.add("open");
  };

  return (
    <>
      <style>{`
        :root {
          --p1:#7c3aed;--p2:#4f46e5;--p3:#06b6d4;
          --bg:#06060f;--bg2:#0d0d1f;--bg3:#12122a;
          --card:#111128;--border:rgba(124,58,237,0.18);
          --text:#e2e8f0;--muted:#94a3b8;
        }
        *{margin:0;padding:0;box-sizing:border-box}
        html{scroll-behavior:smooth}
        body{background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,sans-serif;overflow-x:hidden}

        body::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");opacity:.4;pointer-events:none;z-index:0}

        .blob{position:fixed;border-radius:50%;filter:blur(120px);opacity:.12;pointer-events:none;z-index:0}
        .blob1{width:600px;height:600px;background:var(--p1);top:-150px;left:-100px}
        .blob2{width:500px;height:500px;background:var(--p2);bottom:-100px;right:-100px}
        .blob3{width:300px;height:300px;background:var(--p3);top:50%;left:50%;transform:translate(-50%,-50%)}

        nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:0 5%;height:64px;display:flex;align-items:center;justify-content:space-between;background:rgba(6,6,15,.8);backdrop-filter:blur(20px);border-bottom:1px solid var(--border)}
        .logo{display:flex;align-items:center;gap:10px;font-size:1.1rem;font-weight:700;color:#fff;text-decoration:none}
        .logo-icon{width:32px;height:32px;background:linear-gradient(135deg,var(--p1),var(--p3));border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.9rem}
        .nav-links{display:flex;gap:2rem;list-style:none}
        .nav-links a{color:var(--muted);text-decoration:none;font-size:.9rem;transition:color .2s}
        .nav-links a:hover{color:#fff}
        .nav-right{display:flex;align-items:center;gap:12px}
        .badge-live{background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.3);color:#4ade80;padding:3px 10px;border-radius:20px;font-size:.7rem;font-weight:700;letter-spacing:.05em;animation:pulse 2s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
        .btn{padding:8px 18px;border-radius:8px;font-size:.875rem;font-weight:600;cursor:pointer;border:none;transition:all .2s}
        .btn-ghost{background:transparent;border:1px solid var(--border);color:var(--text)}
        .btn-ghost:hover{border-color:var(--p1);color:#fff}
        .btn-primary{background:linear-gradient(135deg,var(--p1),var(--p2));color:#fff;box-shadow:0 0 20px rgba(124,58,237,.3)}
        .btn-primary:hover{transform:translateY(-1px);box-shadow:0 0 30px rgba(124,58,237,.5)}

        .hero{min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:100px 5% 80px;position:relative;z-index:1}
        .hero-inner{max-width:820px}
        .hero-tag{display:inline-flex;align-items:center;gap:8px;background:rgba(124,58,237,.12);border:1px solid var(--border);border-radius:20px;padding:6px 16px;font-size:.8rem;color:#a78bfa;margin-bottom:24px}
        .hero-tag span{width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 8px #4ade80;animation:pulse 2s infinite}
        h1{font-size:clamp(2.2rem,5vw,4rem);font-weight:800;line-height:1.1;letter-spacing:-.02em;margin-bottom:20px}
        h1 .grad{background:linear-gradient(135deg,#a78bfa,var(--p3));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .hero p{font-size:1.1rem;color:var(--muted);max-width:580px;margin:0 auto 36px;line-height:1.7}
        .hero-ctas{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
        .btn-lg{padding:14px 28px;font-size:1rem;border-radius:10px}
        .btn-outline-lg{background:transparent;border:1px solid var(--border);color:var(--text);padding:14px 28px;font-size:1rem;border-radius:10px;cursor:pointer;font-weight:600;transition:all .2s}
        .btn-outline-lg:hover{border-color:var(--p1);color:#fff}
        .hero-stats{display:flex;gap:40px;justify-content:center;margin-top:56px;flex-wrap:wrap}
        .stat{text-align:center}
        .stat-num{font-size:1.8rem;font-weight:800;background:linear-gradient(135deg,#a78bfa,var(--p3));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .stat-label{font-size:.78rem;color:var(--muted);margin-top:2px}

        .ticker-wrap{background:var(--bg2);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:12px 0;overflow:hidden;position:relative;z-index:1}
        .ticker{display:flex;gap:48px;white-space:nowrap;animation:ticker 20s linear infinite}
        @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .ticker-item{display:flex;align-items:center;gap:8px;font-size:.82rem;color:var(--muted)}
        .ticker-item .dot{width:6px;height:6px;border-radius:50%;background:var(--p3)}
        .ticker-item strong{color:var(--text)}
        .ticker-item .up{color:#4ade80}.ticker-item .dn{color:#f87171}

        section{position:relative;z-index:1;padding:80px 5%}
        .container{max-width:1100px;margin:0 auto}
        .section-tag{display:inline-block;background:rgba(124,58,237,.12);border:1px solid var(--border);border-radius:20px;padding:5px 14px;font-size:.75rem;color:#a78bfa;letter-spacing:.08em;text-transform:uppercase;margin-bottom:16px}
        h2{font-size:clamp(1.8rem,3vw,2.6rem);font-weight:800;letter-spacing:-.02em;margin-bottom:12px}
        h2 .grad{background:linear-gradient(135deg,#a78bfa,var(--p3));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .sub{color:var(--muted);font-size:1rem;line-height:1.7;max-width:560px}

        .overview-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start;margin-top:48px}
        @media(max-width:768px){.overview-grid{grid-template-columns:1fr}}
        .feature-list{display:flex;flex-direction:column;gap:12px;margin-top:24px}
        .feature-item{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 18px;font-size:.9rem;transition:border-color .2s}
        .feature-item:hover{border-color:var(--p1)}
        .feature-item .fi{width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,rgba(124,58,237,.3),rgba(6,182,212,.2));display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0}
        .terminal-mock{background:var(--bg3);border:1px solid var(--border);border-radius:14px;padding:20px;font-family:'Courier New',monospace;font-size:.8rem}
        .t-bar{display:flex;gap:6px;margin-bottom:16px}
        .t-dot{width:10px;height:10px;border-radius:50%}
        .t-line{color:#4ade80;margin-bottom:6px;opacity:0;animation:fadein .4s forwards}
        .t-line:nth-child(2){animation-delay:.3s}
        .t-line:nth-child(3){animation-delay:.6s}
        .t-line:nth-child(4){animation-delay:.9s}
        .t-line:nth-child(5){animation-delay:1.2s}
        .t-line:nth-child(6){animation-delay:1.5s}
        .t-line:nth-child(7){animation-delay:1.8s}
        .t-line .muted{color:var(--muted)}
        .t-line .ok{color:#4ade80}.t-line .warn{color:#fbbf24}.t-line .info{color:#60a5fa}
        @keyframes fadein{to{opacity:1}}

        .cards-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-top:48px}
        .card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:28px;transition:all .3s;position:relative;overflow:hidden}
        .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--p1),var(--p3));opacity:0;transition:opacity .3s}
        .card:hover{border-color:rgba(124,58,237,.4);transform:translateY(-4px);box-shadow:0 20px 40px rgba(0,0,0,.4)}
        .card:hover::before{opacity:1}
        .card-icon{width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,rgba(124,58,237,.25),rgba(79,70,229,.15));display:flex;align-items:center;justify-content:center;font-size:1.3rem;margin-bottom:18px}
        .card h3{font-size:1rem;font-weight:700;margin-bottom:8px}
        .card p{font-size:.875rem;color:var(--muted);line-height:1.65}
        .card-num{position:absolute;top:20px;right:20px;font-size:.7rem;color:rgba(124,58,237,.5);font-family:monospace;font-weight:700}

        .usecases{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;margin-top:48px}
        .uc{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:28px;transition:all .3s}
        .uc:hover{border-color:rgba(6,182,212,.4);box-shadow:0 0 30px rgba(6,182,212,.08)}
        .uc-icon{font-size:2rem;margin-bottom:16px}
        .uc h3{font-size:.95rem;font-weight:700;margin-bottom:8px;color:#e2e8f0}
        .uc p{font-size:.83rem;color:var(--muted);line-height:1.6}

        .who-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;margin-top:48px}
        .who-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:28px;text-align:center;transition:all .3s}
        .who-card:hover{border-color:var(--p1);transform:translateY(-3px)}
        .who-avatar{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--p1),var(--p3));display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin:0 auto 16px}
        .who-card h3{font-size:.95rem;font-weight:700;margin-bottom:8px}
        .who-card p{font-size:.82rem;color:var(--muted);line-height:1.6}

        .steps{display:flex;gap:0;margin-top:48px;position:relative;flex-wrap:wrap}
        .steps::before{content:'';position:absolute;top:28px;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--p1),var(--p3),transparent);opacity:.3}
        .step{flex:1;min-width:200px;text-align:center;padding:0 24px;position:relative}
        .step-num{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--p1),var(--p2));display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:800;margin:0 auto 20px;box-shadow:0 0 20px rgba(124,58,237,.4)}
        .step h3{font-size:1rem;font-weight:700;margin-bottom:8px}
        .step p{font-size:.85rem;color:var(--muted);line-height:1.6}

        .faq-list{max-width:720px;margin:48px auto 0;display:flex;flex-direction:column;gap:12px}
        .faq-item{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden}
        .faq-q{width:100%;background:none;border:none;color:var(--text);font-size:.95rem;font-weight:600;padding:20px 24px;text-align:left;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:color .2s}
        .faq-q:hover{color:#a78bfa}
        .faq-q .arr{transition:transform .3s;font-size:1rem;color:var(--muted)}
        .faq-a{display:none;padding:0 24px 20px;font-size:.875rem;color:var(--muted);line-height:1.7}
        .faq-item.open .faq-a{display:block}
        .faq-item.open .arr{transform:rotate(180deg);color:var(--p1)}
        .faq-item.open .faq-q{color:#a78bfa}

        .cta-banner{background:linear-gradient(135deg,rgba(124,58,237,.15),rgba(6,182,212,.08));border:1px solid var(--border);border-radius:20px;padding:60px;text-align:center;margin:0 5% 80px;position:relative;z-index:1;overflow:hidden}
        .cta-banner::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;background:radial-gradient(circle,rgba(124,58,237,.2),transparent 70%)}
        .cta-banner h2{margin-bottom:12px}
        .cta-banner p{color:var(--muted);margin-bottom:32px;font-size:1rem}
        .cta-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}

        footer{background:var(--bg2);border-top:1px solid var(--border);padding:60px 5% 30px;position:relative;z-index:1}
        .footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;max-width:1100px;margin:0 auto 40px}
        @media(max-width:768px){.footer-grid{grid-template-columns:1fr 1fr}.nav-links{display:none}}
        .footer-brand p{font-size:.875rem;color:var(--muted);line-height:1.7;margin-top:12px;max-width:240px}
        .footer-col h4{font-size:.85rem;font-weight:700;margin-bottom:16px;color:var(--text)}
        .footer-col a{display:block;font-size:.83rem;color:var(--muted);text-decoration:none;margin-bottom:8px;transition:color .2s}
        .footer-col a:hover{color:#a78bfa}
        .footer-bottom{max-width:1100px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;padding-top:24px;border-top:1px solid var(--border);font-size:.8rem;color:var(--muted);flex-wrap:wrap;gap:12px}
        .socials{display:flex;gap:10px}
        .social-btn{width:34px;height:34px;border-radius:8px;background:var(--bg3);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.85rem;transition:all .2s;text-decoration:none;color:var(--text)}
        .social-btn:hover{border-color:var(--p1);background:rgba(124,58,237,.15)}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:rgba(124,58,237,.4);border-radius:3px}
      `}</style>

      <div className="blob blob1" />
      <div className="blob blob2" />
      <div className="blob blob3" />

      {/* NAV */}
      <nav>
        <a className="logo" href="#">
          <div className="logo-icon">⬡</div>
          CryptoCheck<span style={{ color: "#a78bfa" }}>AI</span>
        </a>
        <ul className="nav-links">
          <li><a href="#overview">Overview</a></li>
          <li><a href="#why">Features</a></li>
          <li><a href="#usecases">Use Cases</a></li>
          <li><a href="#steps">Get Started</a></li>
          <li><a href="#faq">FAQ</a></li>
        </ul>
        <div className="nav-right">
          <div className="badge-live">● MAINNET LIVE</div>
          <button className="btn btn-ghost">Docs</button>
          <button className="btn btn-primary">Launch Terminal</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-tag"><span /> Neural Scanner — Solana Mainnet</div>
          <h1>The <span className="grad">AI-Powered</span> Token Scanner for Solana</h1>
          <p>Instantly analyze any token with deep neural intelligence. Detect rug pulls, scan liquidity, track wallets, and trade smarter — all in one terminal.</p>
          <div className="hero-ctas">
            <button className="btn btn-primary btn-lg">Launch Terminal →</button>
            <button className="btn-outline-lg">View Docs</button>
          </div>
          <div className="hero-stats">
            <div className="stat"><div className="stat-num">500K+</div><div className="stat-label">Tokens Scanned</div></div>
            <div className="stat"><div className="stat-num">99.2%</div><div className="stat-label">Rug Detection Rate</div></div>
            <div className="stat"><div className="stat-num">&lt; 0.3s</div><div className="stat-label">Neural Scan Speed</div></div>
            <div className="stat"><div className="stat-num">24/7</div><div className="stat-label">Real-Time Monitoring</div></div>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div className="ticker-wrap">
        <div className="ticker">
          {[
            { label: "SOL", val: "▲ +4.21%", cls: "up" },
            { label: "Neural Scan", val: "ACTIVE", cls: "info" },
            { label: "Last Rug Detected", val: "2 min ago", cls: "warn" },
            { label: "Scans Today", val: "12,847", cls: "up" },
            { label: "Smart Money Wallets", val: "Tracked Live", cls: "info" },
            { label: "Liquidity Alerts", val: "▲ Enabled", cls: "up" },
            { label: "SOL", val: "▲ +4.21%", cls: "up" },
            { label: "Neural Scan", val: "ACTIVE", cls: "info" },
            { label: "Last Rug Detected", val: "2 min ago", cls: "warn" },
            { label: "Scans Today", val: "12,847", cls: "up" },
            { label: "Smart Money Wallets", val: "Tracked Live", cls: "info" },
            { label: "Liquidity Alerts", val: "▲ Enabled", cls: "up" },
          ].map((item, i) => (
            <div key={i} className="ticker-item">
              <div className="dot" />
              <strong>{item.label}</strong>
              <span className={item.cls}>{item.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* OVERVIEW */}
      <section id="overview">
        <div className="container">
          <div style={{ textAlign: "center" }}>
            <div className="section-tag">Overview</div>
            <h2>Everything you need to <span className="grad">trade safely</span></h2>
            <p className="sub" style={{ margin: "0 auto" }}>CryptoCheck AI combines deep on-chain analytics with a proprietary neural scanner to give you an unfair edge on Solana.</p>
          </div>
          <div className="overview-grid">
            <div>
              <p style={{ color: "var(--muted)", lineHeight: 1.8, fontSize: ".95rem" }}>The CryptoCheck AI terminal delivers real-time token intelligence powered by machine learning. Enter any mint address and get an instant neural verdict — authority checks, distribution analysis, liquidity depth, and pattern recognition, all in under a second.</p>
              <div className="feature-list">
                {[
                  ["⚡", "Real-Time Neural Token Analysis"],
                  ["🛡️", "Rug Pull & Authority Detection"],
                  ["💧", "Liquidity Depth Scanning"],
                  ["🐋", "Smart Money & Whale Tracking"],
                  ["📊", "Alpha Feed & Signal Aggregator"],
                  ["🔗", "Solana Mainnet Native Integration"],
                ].map(([icon, label], i) => (
                  <div key={i} className="feature-item">
                    <div className="fi">{icon}</div> {label}
                  </div>
                ))}
              </div>
            </div>
            <div className="terminal-mock">
              <div className="t-bar">
                <div className="t-dot" style={{ background: "#f87171" }} />
                <div className="t-dot" style={{ background: "#fbbf24" }} />
                <div className="t-dot" style={{ background: "#4ade80" }} />
                <span style={{ marginLeft: 8, color: "var(--muted)", fontSize: ".72rem" }}>NEURAL VERDICT TERMINAL — v2.0.0</span>
              </div>
              <div className="t-line"><span className="muted">$</span> initialize_scan --mint <span className="info">Ab3xK...9fPq</span></div>
              <div className="t-line"><span className="ok">✓</span> AUTHORITY CHECK ........... <span className="ok">SAFE</span></div>
              <div className="t-line"><span className="ok">✓</span> DISTRIBUTION ANALYSIS ..... <span className="ok">NORMAL</span></div>
              <div className="t-line"><span className="warn">⚠</span> LIQUIDITY DEPTH SCAN ...... <span className="warn">LOW</span></div>
              <div className="t-line"><span className="ok">✓</span> PATTERN RECOGNITION ....... <span className="ok">CLEAN</span></div>
              <div className="t-line" style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,.05)", paddingTop: 10 }}>
                <span className="muted">NEURAL VERDICT:</span> <span className="ok" style={{ fontWeight: 700 }}>PROCEED WITH CAUTION</span>
              </div>
              <div className="t-line"><span className="muted">SCAN TIME:</span> <span className="info">0.28s</span> <span className="muted">| CONFIDENCE:</span> <span className="ok">94.7%</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section id="why" style={{ background: "var(--bg2)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="container">
          <div style={{ textAlign: "center" }}>
            <div className="section-tag">Why CryptoCheck AI</div>
            <h2>Built for speed, clarity, <span className="grad">and survival</span></h2>
            <p className="sub" style={{ margin: "0 auto" }}>No more getting rugged. No more manual research. CryptoCheck AI does the heavy lifting so you can trade with confidence.</p>
          </div>
          <div className="cards-grid">
            {[
              ["//01", "⚡", "Lightning-Fast Neural Scans", "Sub-second token analysis powered by our proprietary AI model. Get actionable verdicts before the chart even loads."],
              ["//02", "🛡️", "Advanced Rug Detection", "Authority pattern recognition, honeypot checks, and distribution analysis to flag dangerous tokens before you ape in."],
              ["//03", "📡", "Real-Time Alpha Feed", "Live signals aggregated from on-chain data, smart money wallets, and social sentiment — all in a single unified feed."],
              ["//04", "🐋", "Smart Money Tracking", "Follow the wallets of top Solana traders and whales. Know what the smart money is buying before the crowd notices."],
              ["//05", "🔄", "Integrated Quick Execute", "Scan and swap in one flow via Jupiter integration. Trade directly from the terminal with minimal friction and low fees."],
              ["//06", "📊", "Deep Liquidity Metrics", "Analyze pool depth, concentration, and exit risk. Never get caught in a thin market with no way out."],
            ].map(([num, icon, title, desc], i) => (
              <div key={i} className="card">
                <div className="card-num">{num}</div>
                <div className="card-icon">{icon}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section id="usecases">
        <div className="container">
          <div style={{ textAlign: "center" }}>
            <div className="section-tag">Use Cases</div>
            <h2>What you can do with <span className="grad">CryptoCheck AI</span></h2>
          </div>
          <div className="usecases">
            {[
              ["🔍", "Pre-Trade Token Vetting", "Instantly audit any new token launch before committing capital. Catch red flags in seconds, not hours."],
              ["🤖", "Build Automated Bots", "Integrate neural scan verdicts into your trading bots via API to automate safe-entry filtering at scale."],
              ["📈", "Portfolio Risk Monitoring", "Track your holdings for emerging rug signals, authority changes, and liquidity withdrawals in real-time."],
              ["🧠", "On-Chain Due Diligence", "Conduct deep research on wallets, token flows, and project behavior before making large investments."],
            ].map(([icon, title, desc], i) => (
              <div key={i} className="uc">
                <div className="uc-icon">{icon}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOR WHO */}
      <section style={{ background: "var(--bg2)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="container">
          <div style={{ textAlign: "center" }}>
            <div className="section-tag">For Who</div>
            <h2>Made for every type of <span className="grad">Solana participant</span></h2>
          </div>
          <div className="who-grid">
            {[
              ["🦈", "Retail Traders", "Ape safer into new launches with AI-backed confidence and real-time rug protection."],
              ["🏦", "Funds & Asset Managers", "Automate on-chain due diligence and monitor portfolio risk across dozens of positions."],
              ["⚙️", "Developers & Bot Builders", "Embed neural scan results directly into your bots, dashboards, and trading infrastructure."],
              ["🔬", "Researchers & Analysts", "Explore on-chain patterns, wallet behavior, and token metrics with deep data access."],
            ].map(([icon, title, desc], i) => (
              <div key={i} className="who-card">
                <div className="who-avatar">{icon}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section id="steps">
        <div className="container" style={{ textAlign: "center" }}>
          <div className="section-tag">Getting Started</div>
          <h2>Up and running in <span className="grad">under 60 seconds</span></h2>
          <div className="steps">
            {[
              ["1", "Connect Wallet", "Link your Solana wallet to unlock the full terminal and personalized features."],
              ["2", "Enter Mint Address", "Paste any token's mint address to initialize an instant neural scan."],
              ["3", "Get Neural Verdict", "Receive a comprehensive AI analysis with confidence score in under 0.3 seconds."],
              ["4", "Trade or Skip", "Execute directly via Jupiter integration or pass on flagged tokens — your call."],
            ].map(([num, title, desc], i) => (
              <div key={i} className="step">
                <div className="step-num">{num}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ background: "var(--bg2)", borderTop: "1px solid var(--border)" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <div className="section-tag">FAQ</div>
          <h2>Frequently Asked <span className="grad">Questions</span></h2>
          <div className="faq-list">
            {[
              ["What is CryptoCheck AI?", "CryptoCheck AI is a neural scanner terminal for Solana. It uses AI-powered analysis to evaluate any token in real-time — checking authority, liquidity, distribution, and pattern recognition to give you a clear verdict before you trade."],
              ["How accurate is the rug detection?", "Our neural model achieves a 99.2% rug detection rate on historical data, trained on thousands of known rug pulls and honeypot patterns. No scanner is 100% perfect, but CryptoCheck AI gives you a significant edge over manual research."],
              ["Is there a free tier?", "Yes. CryptoCheck AI offers a free tier that allows a limited number of neural scans per day, giving you access to core features without any upfront commitment. PRO plans unlock unlimited scans, the Alpha Feed, and smart money tracking."],
              ["Which chains are supported?", "Currently, CryptoCheck AI is fully integrated with Solana Mainnet. Expansion to additional EVM chains is on the roadmap and will be announced via our official channels."],
              ["Can I use it to build my own bots?", "Absolutely. CryptoCheck AI exposes API endpoints that let you embed neural scan results, wallet tracking, and alpha signals into your own trading bots and applications. Check the documentation for integration guides."],
            ].map(([q, a], i) => (
              <div key={i} className="faq-item">
                <button className="faq-q" onClick={(e) => toggleFaq(e.currentTarget as HTMLButtonElement)}>
                  {q} <span className="arr">▼</span>
                </button>
                <div className="faq-a">{a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <div className="cta-banner">
        <div className="section-tag">Start Now</div>
        <h2>Ready to scan <span className="grad">smarter?</span></h2>
        <p>Join thousands of Solana traders who use CryptoCheck AI to protect their capital and find alpha every day.</p>
        <div className="cta-btns">
          <button className="btn btn-primary btn-lg">Launch Terminal →</button>
          <button className="btn-outline-lg">Read the Docs</button>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-grid">
          <div className="footer-brand">
            <a className="logo" href="#" style={{ textDecoration: "none" }}>
              <div className="logo-icon">⬡</div>
              CryptoCheck<span style={{ color: "#a78bfa" }}>AI</span>
            </a>
            <p>The neural scanner for Solana traders. Real-time token analysis, rug detection, and smart money tracking in one terminal.</p>
            <div className="socials" style={{ marginTop: 16 }}>
              <a className="social-btn" href="#">𝕏</a>
              <a className="social-btn" href="#">✈</a>
              <a className="social-btn" href="#">💬</a>
            </div>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <a href="#">Terminal</a>
            <a href="#">Alpha Feed</a>
            <a href="#">Wallet Tracker</a>
            <a href="#">API Access</a>
            <a href="#">Pricing</a>
          </div>
          <div className="footer-col">
            <h4>Developers</h4>
            <a href="#">API Docs</a>
            <a href="#">Integration Guide</a>
            <a href="#">Webhooks</a>
            <a href="#">Status</a>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <a href="#">About</a>
            <a href="#">Blog</a>
            <a href="#">Litepaper</a>
            <a href="#">Contact</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2025 CryptoCheck AI. All rights reserved.</span>
          <span>Privacy Policy · Terms of Service</span>
        </div>
      </footer>
    </>
  );
}
