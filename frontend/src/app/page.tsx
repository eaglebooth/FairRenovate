"use client";

import React, { useState, useEffect } from "react";
import { 
  connectWallet, 
  readContract, 
  writeContract 
} from "../lib/genlayer";
import { 
  Shield, 
  CheckCircle, 
  Cpu, 
  PlusCircle, 
  Calendar, 
  FileText, 
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Hammer,
  DollarSign,
  Briefcase,
  Users
} from "lucide-react";

interface Project {
  id: number;
  homeowner: string;
  contractor: string;
  phase_name: string;
  budget: number;
  status: string;
  proof_url: string;
  score: number;
  released_payout: number;
  comment: string;
}

interface ConsoleMessage {
  type: "system" | "user" | "pass" | "fail";
  text: string;
}

const DEFAULT_CONTRACT = "0xB3028949Eb5cc9896fc31982C4C90B90863ac123";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const SCENARIOS = [
  {
    name: "Smooth Wall Painting",
    file: "paint_success.txt",
    desc: "Valid Google Drive photo folder showing smooth plaster coating and clean painting layers."
  },
  {
    name: "Uneven Kitchen Tiling",
    file: "tiling_uneven.txt",
    desc: "Tiling inspection showing 3mm grout tilt deflection and slight height lippage defects."
  },
  {
    name: "Manipulated Plaster Photo",
    file: "renovation_cheated.txt",
    desc: "Wall plastering photo containing clone stamps and Photoshop artifacts trying to hide cracking."
  }
];

export default function Home() {
  // Config state
  const [contractAddress, setContractAddress] = useState<string>(DEFAULT_CONTRACT);
  const [walletAccount, setWalletAccount] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string>("Disconnected. Connect wallet to start.");

  // Contract stats
  const [projectCount, setProjectCount] = useState<number>(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeStep, setActiveStep] = useState<number>(1);

  // Form states
  const [formContractor, setFormContractor] = useState<string>("");
  const [formPhaseName, setFormPhaseName] = useState<string>("Living Room Painting");
  const [formBudget, setFormBudget] = useState<string>("500");

  // Proof upload states
  const [selectedProjectId, setSelectedProjectId] = useState<string>("999");
  const [selectedScenarioIdx, setSelectedScenarioIdx] = useState<number>(0);
  const [scenarioPreview, setScenarioPreview] = useState<string>("");

  // Console messages
  const [consoleMsgs, setConsoleMsgs] = useState<ConsoleMessage[]>([
    {
      type: "system",
      text: "System Initialized. Construction Supervising Engineer Node standby..."
    }
  ]);

  // Load contract address from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("fairrenovate_contract_address");
    if (saved && saved !== ZERO_ADDRESS && saved.length === 42) {
      setContractAddress(saved);
      loadContractStateWithAddr(saved);
    }
  }, []);

  // Fetch scenario log file content
  useEffect(() => {
    async function loadScenario() {
      const scen = SCENARIOS[selectedScenarioIdx];
      try {
        const res = await fetch(`/scenarios/${scen.file}`);
        const text = await res.text();
        setScenarioPreview(text);
      } catch (err) {
        setScenarioPreview("Error loading scenario log preview.");
      }
    }
    loadScenario();
  }, [selectedScenarioIdx]);

  // Logger helper
  function log(type: "system" | "user" | "pass" | "fail", text: string) {
    setConsoleMsgs(prev => [...prev, { type, text }]);
  }

  // Wallet connection
  async function handleConnectWallet() {
    setLoading(true);
    log("system", "Connecting MetaMask wallet...");
    const res = await connectWallet();
    setLoading(false);
    if (res.success) {
      setWalletAccount(res.data as string);
      log("system", `Wallet connected: ${shortAddress(res.data as string)}`);
      setSyncStatus("Wallet Connected");
      if (contractAddress && contractAddress !== ZERO_ADDRESS && contractAddress.length === 42) {
        loadContractStateWithAddr(contractAddress);
      }
    } else {
      log("fail", `Connection failed: ${res.error}`);
      setSyncStatus(res.error || "Connection failed");
    }
  }

  // Handle address input and auto-apply
  function handleAddressChange(addr: string) {
    setContractAddress(addr);
    if (addr.length === 42 && addr.startsWith("0x")) {
      localStorage.setItem("fairrenovate_contract_address", addr);
      log("system", `Contract address auto-configured: ${shortAddress(addr)}`);
      loadContractStateWithAddr(addr);
    }
  }

  // Sync state from smart contract with explicit address
  async function loadContractStateWithAddr(addr: string) {
    if (!addr || addr === ZERO_ADDRESS || addr.length !== 42) {
      setSyncStatus("Contract not configured.");
      return;
    }
    setSyncStatus("Syncing...");
    
    // Read count
    const countRes = await readContract("bet_count", [], addr);
    let countVal = 0;
    if (countRes.success) {
      countVal = Number(countRes.data);
      setProjectCount(countVal);
    }

    // Read projects
    const list: Project[] = [];
    for (let i = 0; i < countVal; i++) {
      const res = await readContract("get_project", [i], addr);
      if (res.success && res.data) {
        try {
          const parsed = JSON.parse(res.data as string);
          list.push({
            id: i,
            homeowner: parsed.homeowner,
            contractor: parsed.contractor,
            phase_name: parsed.phase_name,
            budget: Number(parsed.budget),
            status: parsed.status,
            proof_url: parsed.proof_url,
            score: Number(parsed.score),
            released_payout: Number(parsed.released_payout),
            comment: parsed.comment
          });
        } catch (err) {
          console.error("Failed to parse project data JSON", err);
        }
      }
    }
    setProjects(list);
    
    // Auto-select active project
    const activeProjects = list.filter(p => p.status === "ACTIVE" || p.status === "PENDING_AUDIT");
    if (activeProjects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(String(activeProjects[0].id));
    }

    setSyncStatus("Synced");
    log("system", `Synchronized contract state. Found ${countVal} renovation projects.`);
  }

  // Keep compatibility
  async function loadContractState() {
    await loadContractStateWithAddr(contractAddress);
  }

  // Create Project
  async function createProject() {
    if (!formContractor || !formPhaseName || !formBudget) return;
    setLoading(true);
    setSyncStatus("Creating project...");
    log("user", `Create Project: Contractor: ${shortAddress(formContractor)} | Phase: ${formPhaseName} | Budget: $${formBudget}`);

    const res = await writeContract(
      "create_project",
      [formContractor, formPhaseName, BigInt(formBudget)],
      contractAddress
    );

    if (res.success && res.hash) {
      log("system", `Renovation agreement registered! Stake of $${formBudget} locked.`);
      setActiveStep(2);
      await loadContractState();
    } else {
      log("fail", `Failed to create agreement: ${res.error}`);
    }
    setLoading(false);
  }

  // Submit progress proof photo feed URL
  async function handleUploadProof() {
    if (!selectedProjectId) return;
    const scen = SCENARIOS[selectedScenarioIdx];

    // Local simulation case if no contract is loaded or project ID is 999
    if (selectedProjectId === "999" || !contractAddress || contractAddress === ZERO_ADDRESS) {
      setLoading(true);
      setSyncStatus("Simulating audit...");
      log("user", `Upload check-in proof for Demo Project ID 999: Selected Scenario [${scen.name}]`);
      log("system", "Simulating AI Node Juries subjective inspection consensus...");
      
      // Simulate delays for realism
      await new Promise(r => setTimeout(r, 1000));
      log("system", "Node 1 Verdict: Processing image forensic metadata checks...");
      await new Promise(r => setTimeout(r, 1000));
      
      if (scen.file === "paint_success.txt") {
        log("pass", "[Node 1] Quality check passed: Smooth coat verified (95% score).");
        log("pass", "[Node 2] Quality check passed: Edge boundaries clean.");
        log("pass", "[Node 3] Quality check passed: No color variances detected.");
        log("pass", "[VERDICT: COMPLETED] Consensus reached: 95% payout released ($475 USD).");
        log("pass", `Remarks: Surface condition is smooth and paint layers are uniformly applied.`);
      } else if (scen.file === "tiling_uneven.txt") {
        log("pass", "[Node 1] Quality check passed: Grout overlay processed.");
        log("fail", "[Node 2] Warning: 3mm horizontal tilt deflection detected in kitchen wall.");
        log("fail", "[Node 3] Warning: Center tiles have 1.2mm height lippage defects.");
        log("pass", "[VERDICT: COMPLETED] Partial payout approved: 70% released ($350 USD). 30% refunded ($150 USD).");
        log("pass", `Remarks: Grouting thickness has uneven spacing and lippage exceeds 1mm standard.`);
      } else {
        log("fail", "[Node 1] Alert: EXIF metadata shows image was edited with Adobe Photoshop.");
        log("fail", "[Node 2] Alert: Clone stamps coordinates detected. Original cracks concealed.");
        log("fail", "[VERDICT: REJECTED] Fraud detected! Payout declined (0% score). Stake remains locked.");
        log("fail", `Remarks: Manipulated imagery submitted to hide drywall fractures.`);
      }
      setActiveStep(4);
      setSyncStatus("Demo Audited");
      setLoading(false);
      return;
    }

    setLoading(true);
    setSyncStatus("Submitting proof...");
    const logUrl = `https://gymcommit-payroll.vercel.app/scenarios/${scen.file}`;
    log("user", `Upload check-in proof for project ID ${selectedProjectId}: Selected Scenario [${scen.name}]`);

    const res = await writeContract(
      "submit_proof",
      [BigInt(selectedProjectId), logUrl],
      contractAddress
    );

    if (res.success && res.hash) {
      log("system", "Proof log uploaded successfully. Running AI consensus check...");
      setActiveStep(3);
      
      // Step 2: Trigger audit progress evaluation
      setSyncStatus("Auditing progress...");
      const auditRes = await writeContract(
        "audit_project",
        [BigInt(selectedProjectId)],
        contractAddress
      );

      if (auditRes.success && auditRes.hash) {
        log("system", "Supervising Construction Engineer node consensus completed!");
        await loadContractState();
        
        // Print results to console
        const finalProjectRes = await readContract("get_project", [BigInt(selectedProjectId)], contractAddress);
        if (finalProjectRes.success && finalProjectRes.data) {
          const parsed = JSON.parse(finalProjectRes.data as string);
          if (parsed.score > 0) {
            log("pass", `[VERDICT: ${parsed.status}] Score: ${parsed.score}% | Paid: $${parsed.released_payout} USD`);
            log("pass", `Remarks: ${parsed.comment}`);
          } else {
            log("fail", `[VERDICT: REJECTED] Fraud detected! Stake remains locked.`);
            log("fail", `Remarks: ${parsed.comment}`);
          }
        }
        setActiveStep(4);
      } else {
        log("fail", `Consensus audit failed: ${auditRes.error}`);
      }
    } else {
      log("fail", `Failed to upload proof log: ${res.error}`);
    }
    setLoading(false);
  }

  const shortAddress = (addr: string) => addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  const displayProjects = projects.length > 0 ? projects : [
    {
      id: 999,
      homeowner: walletAccount || "0xHomeOwnerDemo",
      contractor: "0xContractorDemo",
      phase_name: "Demo Simulation: Wall Plastering",
      budget: 500,
      status: "ACTIVE",
      proof_url: "",
      score: 0,
      released_payout: 0,
      comment: ""
    }
  ];

  return (
    <div>
      {/* HEADER NAVBAR */}
      <header className="healcure-header">
        <div className="healcure-header-inner">
          <a href="#" className="brand-logo">
            <div className="brand-icon">F</div>
            <span>FairRenovate</span>
          </a>
          <nav className="nav-links">
            <a href="#why-choose-us" className="nav-link">About</a>
            <a href="#audit-standards" className="nav-link">Standards</a>
            <a href="#how-it-works" className="nav-link">Process</a>
            <a href="#sandbox" className="nav-link">Contract Workspace</a>
          </nav>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <input 
                type="text" 
                className="form-input" 
                style={{ 
                  width: "360px", 
                  background: "rgba(255, 255, 255, 0.08)", 
                  border: "1px solid rgba(255, 255, 255, 0.12)", 
                  color: "#ffffff", 
                  fontSize: "0.75rem", 
                  padding: "0.35rem 1rem",
                  borderRadius: "9999px"
                }}
                value={contractAddress}
                onChange={(e) => handleAddressChange(e.target.value)}
                placeholder="Contract Address (starts with 0x...)"
              />
            </div>

            {walletAccount ? (
              <div style={{ color: "#ffffff", fontSize: "0.85rem", fontWeight: "600", background: "rgba(255,255,255,0.05)", padding: "0.5rem 1.25rem", borderRadius: "9999px", border: "1px solid rgba(255,255,255,0.1)" }}>
                {shortAddress(walletAccount)}
              </div>
            ) : (
              <button className="btn-wallet-blue" onClick={handleConnectWallet}>
                <Shield size={14} /> Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="healcure-hero">
        <div className="healcure-hero-inner">
          <div className="hero-left">
            <span className="hero-badge">Trusted 20,000+ Homeowners Worldwide</span>
            <h1 className="hero-title">Fair Renovations.<br /><span>Today. Tomorrow. Always.</span></h1>
            <p className="hero-desc">Take charge of your home decor and renovation contracts. Lock project funds in escrow, and let GenLayer subjective AI Construction Inspectors verify work quality before payment releases.</p>
            <div className="hero-buttons">
              <a href="#sandbox" className="btn-primary">Create Renovate Contract <ArrowRight size={16} /></a>
              <a href="#audit-standards" className="btn-secondary">About Standards</a>
            </div>
          </div>
          <div className="hero-visual" style={{ backgroundImage: "url('/hero_renovation_render.jpg')", backgroundSize: "cover", backgroundPosition: "center" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(7, 14, 27, 0.45)" }}></div>
            <div className="hero-visual-card" style={{ position: "relative", zIndex: 10 }}>
              <Hammer size={32} style={{ color: "var(--primary)", margin: "0 auto" }} />
              <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", fontWeight: "700" }}>Active Milestones Locked</span>
              <span style={{ fontSize: "2rem", fontWeight: "900", color: "#ffffff" }}>${projects.filter(p => p.status === "ACTIVE").reduce((acc, curr) => acc + curr.budget, 0)} USD</span>
              <span style={{ fontSize: "0.75rem", color: "#60a5fa", fontWeight: "600" }}>Protected by AI Inspector Juries</span>
            </div>
          </div>
        </div>
      </section>



      {/* WHY CHOOSE US SECTION */}
      <section className="page-section" id="why-choose-us">
        <div className="section-header">
          <h2>Here's What Sets Us Apart from Standard Contracting</h2>
          <p>Traditional agreements lead to contractor abandonment, paint disputes, or payment arguments. GenLayer automates milestones based on subjective quality audits.</p>
        </div>
        <div className="why-choose-us-layout">
          <div className="why-column">
            <div className="why-card">
              <div className="why-icon"><Shield size={20} /></div>
              <h3>1. Escrow Lock Safety</h3>
              <p>Homeowners lock milestone budgets securely on-chain. Contractors work with peace of mind without worrying about payment defaults.</p>
            </div>
            <div className="why-card">
              <div className="why-icon"><Cpu size={20} /></div>
              <h3>2. AI-PT Supervising Juries</h3>
              <p>Subjective node juries act as impartial construction engineers inspecting detail logs to verify standards.</p>
            </div>
          </div>

          <div className="why-center-image" style={{ backgroundImage: "url('/renovation_engineers.jpg')", backgroundSize: "cover", backgroundPosition: "center" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(7, 14, 27, 0.75) 100%)" }}></div>
            <div style={{ position: "absolute", bottom: "2rem", left: "1.5rem", right: "1.5rem", textAlign: "left", zIndex: 10 }}>
              <h3 style={{ fontSize: "1.5rem", fontWeight: "800", marginBottom: "0.25rem", color: "#ffffff" }}>FairRenovate</h3>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.9rem" }}>On-Site Progress Verification Juries</p>
            </div>
          </div>

          <div className="why-column">
            <div className="why-card">
              <div className="why-icon"><DollarSign size={20} /></div>
              <h3>3. Proportional Payouts</h3>
              <p>Payouts are mathematically scaled based on the audit score. A minor plaster crack gets 90% budget release, 10% penalty return.</p>
            </div>
            <div className="why-card">
              <div className="why-icon"><Users size={20} /></div>
              <h3>4. Zero Mediation Friction</h3>
              <p>Eliminate endless homeowner-contractor bickering. Impartial node validators resolve reviews instantly and objectively.</p>
            </div>
          </div>
        </div>
      </section>

      {/* AUDIT STANDARDS SECTION */}
      <section className="page-section" id="audit-standards" style={{ background: "#f8fafc" }}>
        <div className="audit-standards-layout">
          <div className="audit-visual" style={{ backgroundImage: "url('/inspector_check.jpg')", backgroundSize: "cover", backgroundPosition: "center" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(7, 14, 27, 0.35)" }}></div>
            <div style={{ position: "absolute", bottom: "1.5rem", left: "1.5rem", zIndex: 10, background: "rgba(255,255,255,0.95)", padding: "0.75rem 1.25rem", borderRadius: "12px", border: "1px solid var(--card-border)", boxShadow: "var(--shadow-md)" }}>
              <h4 style={{ fontWeight: 800, color: "var(--text-main)", fontSize: "1rem" }}>Standards Inspection</h4>
              <p style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Grout gaps, Wall smoothness, Paint coatings</p>
            </div>
          </div>
          <div className="audit-list-content">
            <h3>Comprehensive Audit Checkpoints for Renovation Needs</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>GenLayer validator nodes run the subjective prompt checks using specific criteria:</p>
            <div className="audit-bullet-list">
              <div className="audit-bullet-item">
                <CheckCircle size={16} className="audit-check-icon" />
                <span><strong>Wall Plaster Smoothness Check:</strong> Node analyses inspect high-res photos for cracking, hollow sound bubbles, or clone stamp edits.</span>
              </div>
              <div className="audit-bullet-item">
                <CheckCircle size={16} className="audit-check-icon" />
                <span><strong>Ceramic Tiling Ron Alignment Check:</strong> AI inspects grout thickness variances, laser lines deflections, and tile height lippages.</span>
              </div>
              <div className="audit-bullet-item">
                <CheckCircle size={16} className="audit-check-icon" />
                <span><strong>Surface Coating Consistency Check:</strong> Inspections confirm matching paint finishes, baseboard lines, and wood varnishing layer limits.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TIMELINE STEPPER PROCESS */}
      <section className="page-section" id="how-it-works">
        <div className="section-header">
          <h2>Simple Steps to Better Renovations, from Booking to Completion</h2>
          <p>How the decentralized renovation milestone agreement handles flow steps transparently:</p>
        </div>
        
        <div className="stepper-layout">
          <div className="stepper-timeline">
            <div className={`step-node ${activeStep >= 1 ? "active" : ""}`}>
              <div className="step-badge">1</div>
              <div className="step-content">
                <h4>Book Renovation Milestone</h4>
                <p>Homeowner defines contractor address, phase task descriptions, and locks the budget on-chain.</p>
              </div>
            </div>
            <div className={`step-node ${activeStep >= 2 ? "active" : ""}`}>
              <div className="step-badge">2</div>
              <div className="step-content">
                <h4>Submit Progress Logs</h4>
                <p>Contractor completes construction and uploads detailed macro photos of walls or tiling as proof.</p>
              </div>
            </div>
            <div className={`step-node ${activeStep >= 3 ? "active" : ""}`}>
              <div className="step-badge">3</div>
              <div className="step-content">
                <h4>AI Auditor Consensus</h4>
                <p>GenLayer validator nodes execute subjective audits (paint smoothness, tiling alignment) to evaluate quality score.</p>
              </div>
            </div>
            <div className={`step-node ${activeStep >= 4 ? "active" : ""}`}>
              <div className="step-badge">4</div>
              <div className="step-content">
                <h4>Proportional Disbursal</h4>
                <p>Budget splits instantly based on score. 90% score = 90% payout released to contractor, 10% refund back to homeowner.</p>
              </div>
            </div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", justifyContent: "center", background: "#f8fafc", padding: "2.5rem", borderRadius: "24px", border: "1px solid var(--border-light)" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: "800", color: "var(--primary)" }}>Interactive Stepper Status</span>
            <h3 style={{ fontSize: "1.5rem", fontWeight: "800" }}>Stage {activeStep} of 4</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: "1.5" }}>
              {activeStep === 1 && "Create a new project contract below to lock budget stakes."}
              {activeStep === 2 && "Awaiting contractor check-in. Choose a mock photo scenario and click Submit."}
              {activeStep === 3 && "Validators are currently running subjective evaluations and compiling consensus verdict."}
              {activeStep === 4 && "Milestone completed! Check final payouts and AI reports in the dashboard."}
            </p>
          </div>
        </div>
      </section>

      {/* DASHBOARD WORKSPACE */}
      <section className="page-section" id="sandbox" style={{ background: "#fafafa" }}>
        <div className="section-header">
          <h2>Active Contract Workspace Dashboard</h2>
          <p>Lock milestone agreements, upload progress photos, and inspect validator consensus remarks in real time.</p>
        </div>

        <div className="dashboard-grid">
          {/* Row 1: Action Forms Side-by-Side */}
          <div className="dashboard-row">
            {/* Create Project Card */}
            <div className="sandbox-card">
              <div className="sandbox-card-header">
                <span className="sandbox-card-title">
                  <PlusCircle size={18} style={{ color: "var(--primary)" }} /> Book Renovation Contract
                </span>
              </div>
              <div className="sandbox-card-body">
                <div className="form-group">
                  <label className="form-label">Contractor Wallet Address</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={formContractor}
                    onChange={(e) => setFormContractor(e.target.value)}
                    placeholder="0x..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Milestone Phase Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={formPhaseName}
                    onChange={(e) => setFormPhaseName(e.target.value)}
                    placeholder="e.g. Living Room Painting"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                  <label className="form-label">Phase Budget Lock (USD)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={formBudget}
                    onChange={(e) => setFormBudget(e.target.value)}
                    placeholder="500"
                  />
                </div>

                <button 
                  className="btn-primary" 
                  style={{ width: "100%", borderRadius: "8px" }}
                  onClick={!walletAccount ? handleConnectWallet : createProject}
                  disabled={loading || (!!walletAccount && (!formContractor || contractAddress === ZERO_ADDRESS))}
                >
                  {!walletAccount 
                    ? "Connect Wallet to Book" 
                    : contractAddress === ZERO_ADDRESS 
                      ? "Configure Contract Address First" 
                      : "Lock Budget & Register Milestone"}
                </button>
              </div>
            </div>

            {/* Submit Verification Card */}
            <div className="sandbox-card">
              <div className="sandbox-card-header">
                <span className="sandbox-card-title">
                  <FileText size={18} style={{ color: "var(--primary)" }} /> Submit Milestone Progress Proof
                </span>
              </div>
              <div className="sandbox-card-body">
                <div className="form-group">
                  <label className="form-label">Select Active Project ID</label>
                  <select 
                    className="form-input"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                  >
                    {displayProjects.filter(p => p.status === "ACTIVE" || p.status === "PENDING_AUDIT").map(p => (
                      <option key={p.id} value={p.id}>
                        ID {p.id}: {p.phase_name} (${p.budget} USD) {p.id === 999 ? "(Demo)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Select Progress Photo Scenario</label>
                  <div className="scenario-selector">
                    {SCENARIOS.map((s, idx) => (
                      <button 
                        key={idx}
                        className={`scenario-btn ${selectedScenarioIdx === idx ? "active" : ""}`}
                        onClick={() => setSelectedScenarioIdx(idx)}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                    {SCENARIOS[selectedScenarioIdx].desc}
                  </p>
                </div>

                <button 
                  className="btn-primary" 
                  style={{ width: "100%", borderRadius: "8px", marginBottom: "1.25rem" }}
                  onClick={!walletAccount ? handleConnectWallet : handleUploadProof}
                  disabled={loading || (selectedProjectId !== "999" && (!!walletAccount && (!selectedProjectId || contractAddress === ZERO_ADDRESS)))}
                >
                  {selectedProjectId === "999"
                    ? "Simulate Audit (Local Demo)"
                    : !walletAccount 
                      ? "Connect Wallet to Submit" 
                      : contractAddress === ZERO_ADDRESS 
                        ? "Configure Contract Address First" 
                        : "Upload & Audit Progress"}
                </button>

                <div className="form-group" style={{ marginBottom: "0" }}>
                  <label className="form-label">Submitted Log Source Preview</label>
                  <div className="scenario-preview">
                    {scenarioPreview}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Outputs Side-by-Side */}
          <div className="dashboard-row">
            {/* Active Renovation Projects Card */}
            <div className="sandbox-card">
              <div className="sandbox-card-header">
                <span className="sandbox-card-title">
                  <Briefcase size={18} style={{ color: "var(--primary)" }} /> Active Renovation Projects
                </span>
              </div>
              <div className="sandbox-card-body" style={{ display: "block" }}>
                {projects.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)", background: "rgba(0,0,0,0.01)", borderRadius: "12px", border: "1px dashed var(--border-light)" }}>
                    <Hammer size={32} style={{ margin: "0 auto 1rem auto", opacity: 0.3, color: "var(--primary)" }} />
                    <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>No active milestone contracts found.</p>
                    <p style={{ fontSize: "0.75rem" }}>Book a milestone project to list here.</p>
                  </div>
                ) : (
                  <div className="project-list">
                    {projects.map((p) => (
                      <div key={p.id} className="project-item-card">
                        <div className="project-item-header">
                          <span className="project-item-phase">
                            <Hammer size={14} style={{ color: "var(--primary)" }} />
                            ID {p.id}: {p.phase_name}
                          </span>
                          <span className={`project-status-pill ${p.status.toLowerCase()}`}>
                            {p.status.replace("_", " ")}
                          </span>
                        </div>
                        <div className="project-item-details">
                          <span>Homeowner: <strong>{shortAddress(p.homeowner)}</strong></span>
                          <span>Contractor: <strong>{shortAddress(p.contractor)}</strong></span>
                          <span>Locked Budget: <strong>${p.budget} USD</strong></span>
                          <span>Released Payout: <strong style={{ color: "var(--primary)" }}>${p.released_payout} USD ({p.score}%)</strong></span>
                        </div>
                        {p.comment && (
                          <div className="project-item-comment">
                            "{p.comment}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Supervising Juries Consensus Console Card */}
            <div className="sandbox-card">
              <div className="sandbox-card-header">
                <span className="sandbox-card-title">
                  <Cpu size={18} style={{ color: "var(--primary)" }} /> Supervising Juries Consensus Console
                </span>
              </div>
              <div className="sandbox-card-body" style={{ padding: "0" }}>
                <div className="console-container">
                  <div className="console-header">
                    <span>GENLAYER JURY CONSOLE</span>
                    <span>strict_eq Consensus</span>
                  </div>
                  <div className="console-messages">
                    {consoleMsgs.map((msg, idx) => (
                      <div key={idx} className={`console-line ${msg.type}`}>
                        {msg.type === "system" && `[SYS] ${msg.text}`}
                        {msg.type === "user" && `[USR] ${msg.text}`}
                        {msg.type === "pass" && `[✓] ${msg.text}`}
                        {msg.type === "fail" && `[✗] ${msg.text}`}
                      </div>
                    ))}
                  </div>
                  <div className="console-footer">
                    <span>Audit engine status: active</span>
                    <span>RPC: studionet</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
