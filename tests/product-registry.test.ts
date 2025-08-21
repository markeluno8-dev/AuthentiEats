import { describe, it, expect, beforeEach } from "vitest";

interface Product {
  "batch-id": string;
  origin: string;
  quality: bigint;
  certifications: string[];
  "registered-at": bigint;
  "last-updated": bigint;
}

interface HistoryEntry {
  timestamp: bigint;
  updater: string;
  field: string;
  "old-value": string;
  "new-value": string;
}

interface MockContract {
  admin: string;
  paused: boolean;
  nextProductId: bigint;
  authorizedRegistrars: Map<string, boolean>;
  products: Map<bigint, Product>;
  productOwners: Map<bigint, string>;
  updateHistory: Map<bigint, HistoryEntry[]>;
  blockHeight: bigint; // Mock block height

  isAdmin(caller: string): boolean;
  isAuthorizedRegistrar(caller: string): boolean;
  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number };
  addRegistrar(caller: string, registrar: string): { value: boolean } | { error: number };
  removeRegistrar(caller: string, registrar: string): { value: boolean } | { error: number };
  registerProduct(
    caller: string,
    batchId: string,
    origin: string,
    quality: bigint,
    certifications: string[]
  ): { value: bigint } | { error: number };
  updateProduct(
    caller: string,
    id: bigint,
    newBatchId?: string,
    newOrigin?: string,
    newQuality?: bigint,
    newCerts?: string[]
  ): { value: boolean } | { error: number };
  transferOwnership(caller: string, id: bigint, newOwner: string): { value: boolean } | { error: number };
  getProduct(id: bigint): { value: Product } | { error: number };
  getProductOwner(id: bigint): { value: string } | { error: number };
  getUpdateHistory(id: bigint): { value: HistoryEntry[] } | { error: number };
}

const mockContract: MockContract = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  nextProductId: 1n,
  authorizedRegistrars: new Map(),
  products: new Map(),
  productOwners: new Map(),
  updateHistory: new Map(),
  blockHeight: 100n,

  isAdmin(caller: string) {
    return caller === this.admin;
  },

  isAuthorizedRegistrar(caller: string) {
    return this.isAdmin(caller) || this.authorizedRegistrars.get(caller) === true;
  },

  setPaused(caller: string, pause: boolean) {
    if (!this.isAdmin(caller)) return { error: 100 };
    this.paused = pause;
    return { value: pause };
  },

  addRegistrar(caller: string, registrar: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (registrar === "SP000000000000000000002Q6VF78") return { error: 107 };
    this.authorizedRegistrars.set(registrar, true);
    return { value: true };
  },

  removeRegistrar(caller: string, registrar: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    this.authorizedRegistrars.delete(registrar);
    return { value: true };
  },

  registerProduct(caller: string, batchId: string, origin: string, quality: bigint, certifications: string[]) {
    if (this.paused) return { error: 101 };
    if (!this.isAuthorizedRegistrar(caller)) return { error: 100 };
    if (batchId.length > 50) return { error: 104 };
    if (origin.length > 100) return { error: 104 };
    if (quality < 0n || quality > 100n) return { error: 105 };
    if (certifications.length > 10) return { error: 106 };
    for (const cert of certifications) {
      if (cert.length > 50) return { error: 104 };
    }
    const newId = this.nextProductId;
    this.nextProductId += 1n;
    this.products.set(newId, {
      "batch-id": batchId,
      origin,
      quality,
      certifications,
      "registered-at": this.blockHeight,
      "last-updated": this.blockHeight,
    });
    this.productOwners.set(newId, caller);
    this.updateHistory.set(newId, []);
    this.blockHeight += 1n; // Simulate block advance
    return { value: newId };
  },

  updateProduct(caller: string, id: bigint, newBatchId?: string, newOrigin?: string, newQuality?: bigint, newCerts?: string[]) {
    if (this.paused) return { error: 101 };
    const product = this.products.get(id);
    if (!product) return { error: 102 };
    const owner = this.productOwners.get(id) || "SP000000000000000000002Q6VF78";
    if (caller !== owner && !this.isAdmin(caller)) return { error: 100 };
    let changesMade = false;
    let history = this.updateHistory.get(id) || [];
    if (newBatchId !== undefined) {
      if (newBatchId.length > 50) return { error: 104 };
      product["batch-id"] = newBatchId;
      product["last-updated"] = this.blockHeight;
      history.push({
        timestamp: this.blockHeight,
        updater: caller,
        field: "batch-id",
        "old-value": product["batch-id"],
        "new-value": newBatchId,
      });
      changesMade = true;
    }
    if (newOrigin !== undefined) {
      if (newOrigin.length > 100) return { error: 104 };
      product.origin = newOrigin;
      product["last-updated"] = this.blockHeight;
      history.push({
        timestamp: this.blockHeight,
        updater: caller,
        field: "origin",
        "old-value": product.origin,
        "new-value": newOrigin,
      });
      changesMade = true;
    }
    if (newQuality !== undefined) {
      if (newQuality < 0n || newQuality > 100n) return { error: 105 };
      const oldQuality = product.quality.toString();
      product.quality = newQuality;
      product["last-updated"] = this.blockHeight;
      history.push({
        timestamp: this.blockHeight,
        updater: caller,
        field: "quality",
        "old-value": oldQuality,
        "new-value": newQuality.toString(),
      });
      changesMade = true;
    }
    if (newCerts !== undefined) {
      if (newCerts.length > 10) return { error: 106 };
      for (const cert of newCerts) {
        if (cert.length > 50) return { error: 104 };
      }
      const oldCerts = product.certifications.join(",");
      product.certifications = newCerts;
      product["last-updated"] = this.blockHeight;
      history.push({
        timestamp: this.blockHeight,
        updater: caller,
        field: "certifications",
        "old-value": oldCerts,
        "new-value": newCerts.join(","),
      });
      changesMade = true;
    }
    if (!changesMade) return { error: 108 };
    if (history.length > 50) return { error: 109 };
    this.updateHistory.set(id, history);
    this.blockHeight += 1n;
    return { value: true };
  },

  transferOwnership(caller: string, id: bigint, newOwner: string) {
    if (this.paused) return { error: 101 };
    if (!this.products.has(id)) return { error: 102 };
    const currentOwner = this.productOwners.get(id);
    if (!currentOwner || caller !== currentOwner) return { error: 100 };
    if (newOwner === "SP000000000000000000002Q6VF78") return { error: 107 };
    this.productOwners.set(id, newOwner);
    return { value: true };
  },

  getProduct(id: bigint) {
    const product = this.products.get(id);
    if (!product) return { error: 102 };
    return { value: product };
  },

  getProductOwner(id: bigint) {
    const owner = this.productOwners.get(id);
    if (!owner) return { error: 102 };
    return { value: owner };
  },

  getUpdateHistory(id: bigint) {
    const history = this.updateHistory.get(id);
    if (!history) return { error: 102 };
    return { value: history };
  },
};

describe("AuthentiEats Product Registry", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.nextProductId = 1n;
    mockContract.authorizedRegistrars = new Map();
    mockContract.products = new Map();
    mockContract.productOwners = new Map();
    mockContract.updateHistory = new Map();
    mockContract.blockHeight = 100n;
  });

  it("should allow admin to add registrar", () => {
    const result = mockContract.addRegistrar(mockContract.admin, "ST2CY5V39NHDP5PWE4V7E25Q1DGUZTMY4L9RJV6WN");
    expect(result).toEqual({ value: true });
    expect(mockContract.authorizedRegistrars.get("ST2CY5V39NHDP5PWE4V7E25Q1DGUZTMY4L9RJV6WN")).toBe(true);
  });

  it("should prevent non-admin from adding registrar", () => {
    const result = mockContract.addRegistrar("ST2CY5V39NHDP5PWE4V7E25Q1DGUZTMY4L9RJV6WN", "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP");
    expect(result).toEqual({ error: 100 });
  });

  it("should register product by admin", () => {
    const result = mockContract.registerProduct(
      mockContract.admin,
      "BATCH001",
      "Farm XYZ",
      85n,
      ["Organic", "FairTrade"]
    );
    expect(result).toEqual({ value: 1n });
    const product = mockContract.getProduct(1n);
    expect(product).toEqual({
      value: {
        "batch-id": "BATCH001",
        origin: "Farm XYZ",
        quality: 85n,
        certifications: ["Organic", "FairTrade"],
        "registered-at": 100n,
        "last-updated": 100n,
      },
    });
    expect(mockContract.productOwners.get(1n)).toBe(mockContract.admin);
  });

  it("should register product by authorized registrar", () => {
    mockContract.addRegistrar(mockContract.admin, "ST2CY5V39NHDP5PWE4V7E25Q1DGUZTMY4L9RJV6WN");
    const result = mockContract.registerProduct(
      "ST2CY5V39NHDP5PWE4V7E25Q1DGUZTMY4L9RJV6WN",
      "BATCH002",
      "Vineyard ABC",
      90n,
      ["Vegan"]
    );
    expect(result).toEqual({ value: 1n });
  });

  it("should prevent unauthorized registration", () => {
    const result = mockContract.registerProduct(
      "ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP",
      "BATCH003",
      "Factory DEF",
      75n,
      []
    );
    expect(result).toEqual({ error: 100 });
  });

  it("should update product by owner", () => {
    mockContract.registerProduct(mockContract.admin, "BATCH001", "Farm XYZ", 85n, ["Organic"]);
    const updateResult = mockContract.updateProduct(mockContract.admin, 1n, undefined, "New Farm", undefined, undefined);
    expect(updateResult).toEqual({ value: true });
    const product = mockContract.getProduct(1n);
    expect((product as { value: Product }).value.origin).toBe("New Farm");
    const history = mockContract.getUpdateHistory(1n);
    expect((history as { value: HistoryEntry[] }).value.length).toBe(1);
    expect((history as { value: HistoryEntry[] }).value[0].field).toBe("origin");
  });

  it("should prevent update with no changes", () => {
    mockContract.registerProduct(mockContract.admin, "BATCH001", "Farm XYZ", 85n, ["Organic"]);
    const result = mockContract.updateProduct(mockContract.admin, 1n);
    expect(result).toEqual({ error: 108 });
  });

  it("should transfer ownership", () => {
    mockContract.registerProduct(mockContract.admin, "BATCH001", "Farm XYZ", 85n, ["Organic"]);
    const result = mockContract.transferOwnership(
      mockContract.admin,
      1n,
      "ST2CY5V39NHDP5PWE4V7E25Q1DGUZTMY4L9RJV6WN"
    );
    expect(result).toEqual({ value: true });
    expect(mockContract.productOwners.get(1n)).toBe("ST2CY5V39NHDP5PWE4V7E25Q1DGUZTMY4L9RJV6WN");
  });

  it("should not allow actions when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    const regResult = mockContract.registerProduct(mockContract.admin, "BATCH001", "Farm XYZ", 85n, ["Organic"]);
    expect(regResult).toEqual({ error: 101 });
  });

  it("should validate inputs during registration", () => {
    const longBatch = "A".repeat(51);
    const result = mockContract.registerProduct(mockContract.admin, longBatch, "Farm XYZ", 85n, ["Organic"]);
    expect(result).toEqual({ error: 104 });
  });

  it("should validate quality range", () => {
    const result = mockContract.registerProduct(mockContract.admin, "BATCH001", "Farm XYZ", 101n, ["Organic"]);
    expect(result).toEqual({ error: 105 });
  });

  it("should handle max certs", () => {
    const certs = Array(11).fill("Cert");
    const result = mockContract.registerProduct(mockContract.admin, "BATCH001", "Farm XYZ", 85n, certs);
    expect(result).toEqual({ error: 106 });
  });
});