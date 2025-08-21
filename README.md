# AuthentiEats

A blockchain-powered platform for transparent food and beverage supply chain management, enabling consumers to trace product origins, verify authenticity, and ensure fair trade practices — all on-chain to combat counterfeits, build trust, and reduce waste.

---

## Overview

AuthentiEats consists of four main smart contracts that together form a decentralized, transparent, and secure ecosystem for the food and beverage industry:

1. **Product Registry Contract** – Registers and manages product details with origin and quality data.
2. **Supply Chain Tracker Contract** – Tracks product movements from farm to consumer.
3. **NFT Authenticity Contract** – Issues NFTs as certificates of authenticity and ownership.
4. **Payment Splitter Contract** – Automates fair revenue distribution among supply chain participants.

---

## Features

- **Product registration** with immutable origin and quality metadata  
- **Real-time supply chain tracking** for transparency and traceability  
- **NFT-based authenticity certificates** to prevent counterfeits  
- **Automated payment splitting** for fair trade among farmers, processors, and distributors  
- **Consumer verification** tools for scanning and validating products  
- **Waste reduction insights** through tracked inventory data  
- **Integration with off-chain oracles** for real-world verification (e.g., certifications, shipments)  

---

## Smart Contracts

### Product Registry Contract
- Register new products with details like origin, batch ID, and certifications
- Update metadata only by authorized parties (e.g., via multisig)
- Query product history and status

### Supply Chain Tracker Contract
- Log supply chain events (e.g., harvest, processing, shipping, sale)
- Enforce sequential tracking to prevent tampering
- Generate traceability reports for any product ID

### NFT Authenticity Contract
- Mint NFTs linked to physical products for proof of authenticity
- Transfer NFTs upon ownership changes (e.g., resale)
- Burn or invalidate NFTs for recalled or expired items

### Payment Splitter Contract
- Define revenue splits based on roles (e.g., farmer 40%, distributor 30%)
- Automate payouts upon verified milestones (e.g., delivery confirmation)
- Track and audit all transactions for transparency

---

## Installation

1. Install [Clarinet CLI](https://docs.hiro.so/clarinet/getting-started)
2. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/authentieats.git
   ```
3. Run tests:
    ```bash
    npm test
    ```
4. Deploy contracts:
    ```bash
    clarinet deploy
    ```

## Usage

Each smart contract operates independently but integrates with others for a complete supply chain traceability experience.
Refer to individual contract documentation for function calls, parameters, and usage examples.

## License

MIT License