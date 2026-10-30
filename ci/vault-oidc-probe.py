"""Read-only CI path proof using the existing GitHub OIDC role; revoke test token."""
import json
import os
import urllib.error
import urllib.request


def request(url, headers, body=None):
    headers = dict(headers, **{"User-Agent": "DownOps-Vault-CI-Probe/1.0"})
    try:
        req = urllib.request.Request(url, headers=headers, data=body)
        with urllib.request.urlopen(req, timeout=30) as response:
            data = response.read()
            return response.status, json.loads(data) if data else None
    except urllib.error.HTTPError as error:
        return error.code, None


def main():
    vault = "https://vault.downops.win/v1/"
    url = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
    if not url.startswith("https://"):
        raise RuntimeError("https_required")
    status, oidc = request(url + "&audience=vault", {"Authorization": "Bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]})
    result = {"oidc_request_status": status, "role": os.environ["VAULT_PROBE_ROLE"], "probes": []}
    if status != 200:
        return result
    status, login = request(vault + "auth/github-actions/login", {"Content-Type": "application/json"}, json.dumps({"role": os.environ["VAULT_PROBE_ROLE"], "jwt": oidc["value"]}).encode())
    oidc = None
    result["login_status"] = status
    if status != 200:
        return result
    token = login["auth"]["client_token"]
    login = None
    headers = {"X-Vault-Token": token}
    try:
        code, metadata = request(vault + "auth/token/lookup-self", headers)
        result["lookup_status"] = code
        if code == 200:
            result["token_metadata"] = {key: metadata["data"].get(key) for key in ["accessor", "policies", "ttl", "renewable", "path"]}
        for path in json.loads(os.environ["VAULT_PROBE_PATHS_JSON"]):
            code, secret = request(vault + path, headers)
            result["probes"].append({"path": path, "status": code, "key_names": sorted(secret.get("data", {}).get("data", {})) if secret else []})
    finally:
        result["self_revoke_status"] = request(vault + "auth/token/revoke-self", headers, b"{}")[0]
        token = None
        headers = None
    result["verified"] = result.get("lookup_status") == 200 and result["self_revoke_status"] == 204 and all(probe["status"] == 200 for probe in result["probes"])
    return result


if __name__ == "__main__":
    try:
        result = main()
    except Exception:
        result = {"verified": False, "error": "oidc_or_probe_failed"}
    print("VAULT_OIDC_PROBE_RESULT=" + json.dumps(result, sort_keys=True))
    raise SystemExit(0 if result.get("verified") else 1)
