import * as assert from "node:assert/strict";
import { test } from "node:test";

import { StellarisError } from "../dist/errors.js";
import {
  BindingSorobanTransport,
} from "../dist/transport.js";
import type { ContractInvoker, TransactionPlan } from "../dist/transport.js";

const deployment = {
  contractId: "CCONTRACT",
  networkPassphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://example.invalid/rpc",
};

function writePlan(overrides: Partial<TransactionPlan> = {}): TransactionPlan {
  return {
    operation: "set_oracle",
    contractId: deployment.contractId,
    args: ["GORACLE"],
    deployment,
    ...overrides,
  };
}

function readPlan(overrides: Partial<TransactionPlan> = {}): TransactionPlan {
  return {
    operation: "get_oracle",
    contractId: deployment.contractId,
    args: [],
    deployment,
    ...overrides,
  };
}

test("write invoke is not retried without an idempotency key", async () => {
  let attempts = 0;
  const invoker: ContractInvoker = {
    async invoke() {
      attempts += 1;
      throw StellarisError.transport("timeout submitting transaction");
    },
    async simulate() {
      return null;
    },
  };

  const transport = new BindingSorobanTransport({ invoker, baseDelayMs: 0, maxAttempts: 3 });
  await assert.rejects(() => transport.invoke(writePlan()), StellarisError);
  assert.equal(attempts, 1);
});

test("write invoke retries when an idempotency key is supplied", async () => {
  let attempts = 0;
  const invoker: ContractInvoker = {
    async invoke() {
      attempts += 1;
      if (attempts < 2) {
        throw StellarisError.transport("temporary submit failure");
      }
      return { value: undefined };
    },
    async simulate() {
      return null;
    },
  };

  const transport = new BindingSorobanTransport({ invoker, baseDelayMs: 0, maxAttempts: 3 });
  await transport.invoke(writePlan({ idempotencyKey: "issuer:period:1" }));
  assert.equal(attempts, 2);
});

test("read simulations still retry transient failures", async () => {
  let attempts = 0;
  const invoker: ContractInvoker = {
    async invoke() {
      return { value: undefined };
    },
    async simulate<T>() {
      attempts += 1;
      if (attempts < 2) {
        throw new Error("temporary rpc failure");
      }
      return "GORACLE" as T;
    },
  };

  const transport = new BindingSorobanTransport({ invoker, baseDelayMs: 0, maxAttempts: 3 });
  assert.equal(await transport.simulate(readPlan()), "GORACLE");
  assert.equal(attempts, 2);
});

test("retry options reject invalid values", () => {
  const invoker: ContractInvoker = {
    async invoke() {
      return { value: undefined };
    },
    async simulate() {
      return null;
    },
  };

  assert.throws(() => new BindingSorobanTransport({ invoker, maxAttempts: 0 }), StellarisError);
  assert.throws(() => new BindingSorobanTransport({ invoker, baseDelayMs: -1 }), StellarisError);
});
