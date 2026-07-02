#!/usr/bin/env node
// B-P3 attack inputs for por_v2. Signal names match por_v2.circom:
//   reserve[16], reserveSalt, userId[256], balance[256], liabSalt[256], period_in
//
// - control:  honest input (must prove).
// - overflow: one leaf balance = 2^64 (out of the [0,2^64) range the circuit
//             enforces). The leaf RangeCheck(64) makes this UNSATISFIABLE — the
//             custodian cannot use a wraparound balance to hide liability (T2).
import { writeFileSync } from "node:fs";

const N_RES = 16;
const DEPTH = 8;
const N = 1 << DEPTH;
const outDir = process.argv[2] || "build/spike";

function baseLeaves() {
  const userId = [], balance = [], liabSalt = [];
  for (let i = 0; i < N; i++) {
    userId.push(BigInt(i + 1).toString());
    balance.push(BigInt((i % 7) * 100).toString());
    liabSalt.push(BigInt(i + 1000).toString());
  }
  return { userId, balance, liabSalt };
}

function reserves() {
  const reserve = [];
  for (let i = 0; i < N_RES; i++) reserve.push("10000");
  return reserve;
}

// control: honest, proves.
{
  const { userId, balance, liabSalt } = baseLeaves();
  writeFileSync(`${outDir}/por_v2_attack_control.json`, JSON.stringify({
    reserve: reserves(), reserveSalt: "999999",
    userId, balance, liabSalt, period_in: "1",
  }, null, 1));
}

// overflow: leaf 3 balance = 2^64 (one past the allowed 64-bit range).
{
  const { userId, balance, liabSalt } = baseLeaves();
  balance[3] = (2n ** 64n).toString(); // RangeCheck(64) must reject this
  writeFileSync(`${outDir}/por_v2_attack_overflow.json`, JSON.stringify({
    reserve: reserves(), reserveSalt: "999999",
    userId, balance, liabSalt, period_in: "1",
  }, null, 1));
}

console.log("[OK] wrote por_v2 attack inputs (control + overflow) to " + outDir);
console.log("     overflow case: leaf[3].balance = 2^64 (must fail RangeCheck(64))");
