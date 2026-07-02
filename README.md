# FairRenovate 🏠

**FairRenovate** is an on-chain renovation and interior design milestone contract system. Homeowners lock project funds in the contract, and GenLayer AI validation nodes acting as subjective "Construction Supervising Juries" audit progress photographs to automatically disburse funds to contractors proportionally.

---

## 🛠️ Key Features

* **Locked Budget Escrow**: Homeowners escrow stage budgets securely on-chain. Contractors have payment safety guarantee without fearing client default.
* **AI Supervisor Node Consensus**: GenLayer nodes run subjective quality checks on photo proofs (paint smoothness, tiling grout lines).
* **Proportional Disbursal**: Payout splits automatically based on the quality score (e.g. 90% score release 90% budget to contractor, refund 10% back to homeowner for defects).
* **Healcure Inspired Layout**: Beautiful royal blue design featuring a dark hero block, vertical timeline stepper, value grid, and a developer sandbox workspace.

---

## 📁 Repository Structure

```bash
├── contracts/
│   └── FairRenovate.py          # Intelligent GenLayer Smart Contract
├── tests/
│   └── test_contract_static.py  # Static AST rules check script
└── frontend/
    ├── src/
    │   ├── app/                 # Next.js pages & CSS styles
    │   └── lib/                 # Custom GenLayer Web3 helper connection client
    └── public/scenarios/        # Simulated paint and tiling check-in logs
```

---

## 🚀 Run Locally

### 1. Pre-deployment AST Check
Verify that the contract satisfies AST virtual machine safety regulations:
```bash
python tests/test_contract_static.py
```

### 2. Launch Next.js Web Interface
To run the front-end dashboard on local port `3045`:
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the clean modules:
   ```bash
   npm install
   ```
3. Boot the Next.js development server:
   ```bash
   npm run dev -- -p 3045
   ```
4. Navigate to [http://localhost:3045](http://localhost:3045) on your browser.
