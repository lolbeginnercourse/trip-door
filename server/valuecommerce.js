"use strict";

const TOKEN_ENDPOINT = "https://api.valuecommerce.com/auth/v1/affiliate/token/?grant_type=client_credentials";
const TOKEN_TTL_MS = 25 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

let tokenCache = null;
let pendingRequest = null;

function findBearerToken(data) {
  if (typeof data?.bearer_token === "string") return data.bearer_token;
  const rowData = data?.resultSet?.rowData;
  if (typeof rowData?.bearer_token === "string") return rowData.bearer_token;
  if (Array.isArray(rowData)) {
    const row = rowData.find(item => typeof item?.bearer_token === "string");
    if (row) return row.bearer_token;
  }
  return null;
}

async function requestToken() {
  const clientKey = process.env.VALUECOMMERCE_CLIENT_KEY;
  const clientSecret = process.env.VALUECOMMERCE_CLIENT_SECRET;
  if (!clientKey || !clientSecret) throw new Error("valuecommerce_not_configured");

  const signature = Buffer.from(`${clientKey}|${clientSecret}`, "utf8").toString("base64");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${signature}`
      },
      signal: controller.signal
    });
    if (!response.ok) {
      const error = new Error(response.status === 403 ? "valuecommerce_locked" : "valuecommerce_auth_failed");
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    const token = findBearerToken(data);
    if (!token) throw new Error("valuecommerce_invalid_response");
    tokenCache = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
    return token;
  } finally {
    clearTimeout(timeout);
  }
}

async function getValueCommerceToken({ forceRefresh = false } = {}) {
  if (!forceRefresh && tokenCache?.expiresAt > Date.now()) return tokenCache.token;
  if (!pendingRequest) {
    pendingRequest = requestToken().finally(() => { pendingRequest = null; });
  }
  return pendingRequest;
}

function clearValueCommerceToken() {
  tokenCache = null;
}

module.exports = { getValueCommerceToken, clearValueCommerceToken };

