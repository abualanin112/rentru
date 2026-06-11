import { AsyncLocalStorage } from 'node:async_hooks';

const ALS_SYMBOL = Symbol.for('notes-backend.shared.als.singleton');

// eslint-disable-next-line security/detect-object-injection
if (!global[ALS_SYMBOL]) {
  // eslint-disable-next-line security/detect-object-injection
  global[ALS_SYMBOL] = new AsyncLocalStorage();
}

// eslint-disable-next-line security/detect-object-injection
export const als = global[ALS_SYMBOL];

export const alsGetters = {
  getStore: () => als.getStore() || {},
  getUserId: () => alsGetters.getStore().userId,
  getBranchId: () => alsGetters.getStore().branchId,
  getScope: () => alsGetters.getStore().scope,
  isSuperAdmin: () => alsGetters.getStore().isSuperAdmin === true,
  getReqId: () => alsGetters.getStore().reqId,
  getLogger: () => alsGetters.getStore().logger,
};
