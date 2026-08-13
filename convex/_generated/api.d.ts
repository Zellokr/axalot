/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actionProposals from "../actionProposals.js";
import type * as approvals from "../approvals.js";
import type * as auditLogs from "../auditLogs.js";
import type * as axalotAgent from "../axalotAgent.js";
import type * as dashboard from "../dashboard.js";
import type * as domain_access from "../domain/access.js";
import type * as domain_identity from "../domain/identity.js";
import type * as domain_policyEngine from "../domain/policyEngine.js";
import type * as employees from "../employees.js";
import type * as helpers_validators from "../helpers/validators.js";
import type * as model_approvals from "../model/approvals.js";
import type * as model_audit from "../model/audit.js";
import type * as model_auditLogs from "../model/auditLogs.js";
import type * as model_dashboard from "../model/dashboard.js";
import type * as model_employees from "../model/employees.js";
import type * as model_permissions from "../model/permissions.js";
import type * as model_policies from "../model/policies.js";
import type * as model_resources from "../model/resources.js";
import type * as permissions from "../permissions.js";
import type * as policies from "../policies.js";
import type * as resources from "../resources.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actionProposals: typeof actionProposals;
  approvals: typeof approvals;
  auditLogs: typeof auditLogs;
  axalotAgent: typeof axalotAgent;
  dashboard: typeof dashboard;
  "domain/access": typeof domain_access;
  "domain/identity": typeof domain_identity;
  "domain/policyEngine": typeof domain_policyEngine;
  employees: typeof employees;
  "helpers/validators": typeof helpers_validators;
  "model/approvals": typeof model_approvals;
  "model/audit": typeof model_audit;
  "model/auditLogs": typeof model_auditLogs;
  "model/dashboard": typeof model_dashboard;
  "model/employees": typeof model_employees;
  "model/permissions": typeof model_permissions;
  "model/policies": typeof model_policies;
  "model/resources": typeof model_resources;
  permissions: typeof permissions;
  policies: typeof policies;
  resources: typeof resources;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  rag: import("@convex-dev/rag/_generated/component.js").ComponentApi<"rag">;
};
