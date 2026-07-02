/**
 * Domain model for the Stellaris proof-of-reserves SDK.
 *
 * This file intentionally has no Stellar SDK or snarkjs imports. Mature SDKs keep
 * domain primitives independent from transport/proving so they can be reused by
 * CLIs, backend services, browser apps, tests, and indexers.
 */
import { MAX_RESERVE, N_RESERVES } from "./constants.js";
import { StellarisError } from "./errors.js";
export function normalizeSnapshot(snapshot) {
    if (snapshot.accounts.length === 0) {
        throw StellarisError.validation("reserve snapshot must include at least one account");
    }
    if (snapshot.accounts.length > N_RESERVES) {
        throw StellarisError.validation(`reserve snapshot has ${snapshot.accounts.length} accounts; max is ${N_RESERVES}`);
    }
    if (snapshot.periodId < 0n) {
        throw StellarisError.validation("periodId must be non-negative");
    }
    if (snapshot.salt < 0n) {
        throw StellarisError.validation("salt must be non-negative");
    }
    if (snapshot.liabilities.total < 0n) {
        throw StellarisError.validation("liabilities must be non-negative");
    }
    const balances = snapshot.accounts.map((account, index) => {
        if (!account.label || account.label.trim().length === 0) {
            throw StellarisError.validation(`reserve account ${index} is missing a label`);
        }
        if (account.balance < 0n || account.balance > MAX_RESERVE) {
            throw StellarisError.validation(`reserve account ${account.label} balance is outside uint64 range`);
        }
        return account.balance;
    });
    return {
        periodId: snapshot.periodId,
        balances,
        liabilities: snapshot.liabilities.total,
        salt: snapshot.salt,
        accounts: snapshot.accounts,
        ...(snapshot.metadata === undefined ? {} : { metadata: snapshot.metadata }),
    };
}
export function totalReserves(snapshot) {
    return snapshot.balances.reduce((sum, balance) => sum + balance, 0n);
}
export function isSolvent(snapshot) {
    return totalReserves(snapshot) >= snapshot.liabilities;
}
export function toReserveInput(snapshot) {
    return {
        balances: [...snapshot.balances],
        salt: snapshot.salt,
        liabilities: snapshot.liabilities,
        periodId: snapshot.periodId,
    };
}
